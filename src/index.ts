import { Elysia, t } from 'elysia';
import { cors } from '@elysia/cors'
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client";
import { encryption } from './utils/encryption';

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const app = new Elysia()
    .use(cors())
    .get('/', async () => 'ok')
    .get('/users', async () => { 
        return await prisma.user.findMany() })
    .group('/auth', (app) => app
        .post('/sign-up', async ({ body }) => {
            try{return await prisma.user.create({
                data:
                {
                    name: body.name,
                    email: body.email,
                    password: encryption(body.password),
                    address: body.address,
                    phone: body.phone,
                }
            })}
            catch(e){
                if (e instanceof Prisma.PrismaClientKnownRequestError) {
                    if (e.code === 'P2002') {
                      // target will be ['email']
                      if ((e.meta?.target as String[]).includes('email')) {
                        return { message: 'Email already registered' }
                    }
                    if ((e.meta?.target as String[]).includes('phone')) {
                        return { message: 'Phone already registered' }
                    }
                    }
                  }
            }
        },
            {
                body: t.Object({
                    name: t.String(),
                    email: t.String(),
                    password: t.String(),
                    address: t.String(),
                    phone: t.String()
                })
            })
        .post('/sign-in', async ({ body }) => {
            const user = await prisma.user.findUnique({
                where:
                {
                    email: body.email,
                }
            })

           return encryption(body.password) == user?.password;

            
        },
            {
                body: t.Object({
                    email: t.String(),
                    password: t.String()
                })
            }
        )
            
    )
    .listen(3000)

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)