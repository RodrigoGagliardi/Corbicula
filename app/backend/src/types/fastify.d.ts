// `export {}` é obrigatório: transforma este arquivo em módulo TypeScript,
// fazendo com que os blocos `declare module` sejam tratados como augmentations
// (extensão de módulos existentes) e não como ambient module declarations
// (que substituiriam/ofuscariam os tipos originais do Fastify).
export {};

// Estende FastifyRequest com propriedades customizadas da aplicação.
// O Fastify v5 usa dois caminhos de módulo para o mesmo tipo; ambos precisam
// receber a propriedade para que as anotações funcionem corretamente.
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

declare module "fastify/types/request" {
  interface FastifyRequest {
    userId: string;
  }
}

// Adiciona campos OpenAPI ao FastifySchema base.
// O @fastify/swagger normalmente faz isso, mas sua augmentation não cruza
// sub-paths de módulo (a do plugin toca "fastify"; as rotas usam
// "fastify/types/schema" via FastifyPluginAsync).
declare module "fastify/types/schema" {
  interface FastifySchema {
    tags?: string[];
    summary?: string;
    description?: string;
    operationId?: string;
  }
}
