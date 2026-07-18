import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../lib/prisma'

type DatabaseClient = typeof prisma | Prisma.TransactionClient

export type PromotionItemInput = {
    productId: number
    name: string
    quantity: number
    price: Prisma.Decimal
    categories: { id: number; name: string }[]
}

export type PromotionCalculation = {
    items: {
        productId: number
        name: string
        quantity: number
        originalPrice: number
        finalPrice: number
        discountApplied: number
    }[]
    subtotal: number
    discount: number
    total: number
    promotionsApplied: {
        category: string
        productName: string
        originalPrice: number
        discountAmount: number
        finalPrice: number
    }[]
}

export async function calculatePromotions(
    inputItems: PromotionItemInput[],
    db: DatabaseClient = prisma
): Promise<PromotionCalculation> {
    const categoryIds = [...new Set(inputItems.flatMap(item => item.categories.map(category => category.id)))]
    const promotions = categoryIds.length
        ? await db.promotion.findMany({
            where: { isActive: true, categoryId: { in: categoryIds } },
            include: { category: true }
        })
        : []

    const discountsByProduct = new Map<number, Prisma.Decimal>()
    const promotionsApplied: PromotionCalculation['promotionsApplied'] = []

    for (const promotion of promotions) {
        const qualifyingItems = inputItems
            .filter(item =>
                item.categories.some(category => category.id === promotion.categoryId) &&
                item.price.greaterThanOrEqualTo(promotion.minPrice)
            )
            .sort((a, b) => a.price.comparedTo(b.price))

        if (qualifyingItems.length < 2) continue

        const cheapest = qualifyingItems[0]!
        const unitDiscount = cheapest.price.mul(promotion.discount).div(100).toDecimalPlaces(2)
        const discountForLine = unitDiscount.mul(cheapest.quantity)
        discountsByProduct.set(
            cheapest.productId,
            (discountsByProduct.get(cheapest.productId) ?? new Prisma.Decimal(0)).add(unitDiscount)
        )

        promotionsApplied.push({
            category: promotion.category.name,
            productName: cheapest.name,
            originalPrice: cheapest.price.toNumber(),
            discountAmount: discountForLine.toNumber(),
            finalPrice: Prisma.Decimal.max(cheapest.price.sub(unitDiscount), 0).toNumber()
        })
    }

    let subtotal = new Prisma.Decimal(0)
    let totalDiscount = new Prisma.Decimal(0)

    const items = inputItems.map(item => {
        const unitDiscount = Prisma.Decimal.min(
            discountsByProduct.get(item.productId) ?? new Prisma.Decimal(0),
            item.price
        )
        const finalPrice = item.price.sub(unitDiscount)
        subtotal = subtotal.add(item.price.mul(item.quantity))
        totalDiscount = totalDiscount.add(unitDiscount.mul(item.quantity))

        return {
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            originalPrice: item.price.toNumber(),
            finalPrice: finalPrice.toNumber(),
            discountApplied: unitDiscount.mul(item.quantity).toNumber()
        }
    })

    return {
        items,
        subtotal: subtotal.toNumber(),
        discount: totalDiscount.toNumber(),
        total: subtotal.sub(totalDiscount).toNumber(),
        promotionsApplied
    }
}
