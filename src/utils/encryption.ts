export async function encryption(password: string): Promise<string> {
    const argonHash = await Bun.password.hash(password, {
        algorithm: "argon2id",
        memoryCost: 19456,
        timeCost: 2
    })

    return argonHash
}

