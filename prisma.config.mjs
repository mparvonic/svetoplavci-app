export default {
  schema: "./prisma/schema.prisma",
  datasource: {
    url: process.env.POSTGRES_PRISMA_URL ?? "",
  },
};
