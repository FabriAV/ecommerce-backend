import { jwt } from '@elysia/jwt'

export const pluginJWT = jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!
})
