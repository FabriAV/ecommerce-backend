import { prisma } from '../src/lib/prisma'
import { encryption } from '../src/utils/encryption'

const categories = [
    ['Tecnología', 'Dispositivos y equipos tecnológicos'],
    ['Accesorios', 'Complementos para tus dispositivos'],
    ['Estudio', 'Herramientas para aprender y trabajar'],
    ['Setup', 'Productos para mejorar tu espacio de trabajo'],
    ['Fotografía', 'Equipos y accesorios fotográficos'],
    ['Libros', 'Lecturas para aprender e inspirarse']
] as const

const products = [
    ['Laptop Pro 14', 'Portátil para trabajo profesional', 1299.90, 8, ['Tecnología']],
    ['Smartphone X', 'Teléfono 5G de alto rendimiento', 699.90, 12, ['Tecnología']],
    ['Tablet 11', 'Tablet ligera para productividad', 449.90, 0, ['Tecnología', 'Estudio']],
    ['Auriculares Bluetooth', 'Audio inalámbrico con cancelación de ruido', 89.90, 25, ['Accesorios']],
    ['Cargador USB-C', 'Cargador rápido de 65 W', 39.90, 30, ['Accesorios']],
    ['Hub USB-C', 'Hub multipuerto de aluminio', 54.90, 0, ['Accesorios', 'Setup']],
    ['Calculadora científica', 'Calculadora para ciencias e ingeniería', 29.90, 18, ['Estudio']],
    ['Cuaderno premium', 'Cuaderno de tapa dura y papel grueso', 14.90, 40, ['Estudio']],
    ['Lámpara de escritorio', 'Lámpara LED regulable', 44.90, 10, ['Setup']],
    ['Soporte para monitor', 'Soporte ergonómico ajustable', 74.90, 7, ['Setup']],
    ['Teclado mecánico', 'Teclado compacto con switches táctiles', 99.90, 15, ['Setup', 'Tecnología']],
    ['Cámara mirrorless', 'Cámara compacta con sensor APS-C', 899.90, 5, ['Fotografía']],
    ['Trípode de viaje', 'Trípode ligero de aluminio', 69.90, 9, ['Fotografía', 'Accesorios']],
    ['Fotografía esencial', 'Guía práctica de composición y luz', 24.90, 20, ['Fotografía', 'Libros']],
    ['Clean Code', 'Principios para escribir código mantenible', 39.90, 0, ['Libros', 'Tecnología']]
] as const

const productImages: Record<string, string[]> = {
    'Laptop Pro 14': ['https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=85'],
    'Smartphone X': ['https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=1200&q=85'],
    'Tablet 11': ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1561154464-82e9adf32764?auto=format&fit=crop&w=1200&q=85'],
    'Auriculares Bluetooth': ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=85'],
    'Cargador USB-C': ['https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1609592424109-dd092c4840d2?auto=format&fit=crop&w=1200&q=85'],
    'Hub USB-C': ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1625842268584-8f329041410c?auto=format&fit=crop&w=1200&q=85'],
    'Calculadora científica': ['https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?auto=format&fit=crop&w=1200&q=85'],
    'Cuaderno premium': ['https://images.unsplash.com/photo-1531346878377-a5be20888e57?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=85'],
    'Lámpara de escritorio': ['https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1534073828943-f801091bb18c?auto=format&fit=crop&w=1200&q=85'],
    'Soporte para monitor': ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=1200&q=85'],
    'Teclado mecánico': ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1200&q=85'],
    'Cámara mirrorless': ['https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=85'],
    'Trípode de viaje': ['https://images.unsplash.com/photo-1606986628253-39e7a58e4b36?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&w=1200&q=85'],
    'Fotografía esencial': ['https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=1200&q=85'],
    'Clean Code': ['https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&w=1200&q=85', 'https://images.unsplash.com/photo-1495446815901-a7297e633e8d?auto=format&fit=crop&w=1200&q=85']
}

async function main() {
    const [adminPassword, userPassword] = await Promise.all([
        encryption('Admin123!'),
        encryption('User123!')
    ])

    await prisma.user.upsert({
        where: { email: 'admin@mercadeto.test' },
        update: {},
        create: { email: 'admin@mercadeto.test', password: adminPassword, address: 'Av. Principal 100', phone: '+51900000001', name: 'Admin Mercadeto', isAdmin: true }
    })
    await prisma.user.upsert({
        where: { email: 'user@mercadeto.test' },
        update: {},
        create: { email: 'user@mercadeto.test', password: userPassword, address: 'Calle Comercio 200', phone: '+51900000002', name: 'Usuario Demo' }
    })

    for (const [name, description] of categories) {
        await prisma.category.upsert({ where: { name }, update: { description }, create: { name, description } })
    }

    for (const [name, description, price, stock, categoryNames] of products) {
        const existing = await prisma.product.findFirst({ where: { name } })
        if (existing) {
            await prisma.product.update({
                where: { id: existing.id },
                data: {
                    description,
                    price,
                    stock,
                    isActive: true,
                    images: productImages[name] ?? [],
                    categories: { set: categoryNames.map(category => ({ name: category })) }
                }
            })
        } else {
            await prisma.product.create({
                data: { name, description, price, stock, images: productImages[name] ?? [], categories: { connect: categoryNames.map(category => ({ name: category })) } }
            })
        }
    }

    for (const promotion of [
        { category: 'Tecnología', minPrice: 500, discount: 10 },
        { category: 'Estudio', minPrice: 50, discount: 15 }
    ]) {
        const category = await prisma.category.findUniqueOrThrow({ where: { name: promotion.category } })
        const existing = await prisma.promotion.findFirst({ where: { categoryId: category.id, isActive: true } })
        if (!existing) await prisma.promotion.create({ data: { categoryId: category.id, minPrice: promotion.minPrice, discount: promotion.discount } })
    }
}

main()
    .then(() => prisma.$disconnect())
    .catch(async error => {
        console.error(error)
        await prisma.$disconnect()
        process.exit(1)
    })
