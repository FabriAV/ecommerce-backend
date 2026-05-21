export function encryption(data: string): string{
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(data);
    return hasher.digest("hex")
}