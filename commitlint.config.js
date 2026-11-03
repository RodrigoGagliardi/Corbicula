/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Escopos válidos — ajustar conforme o projeto cresce
    "scope-enum": [
      2,
      "always",
      [
        "backend",
        "frontend",
        "analytics",
        "auth",
        "colonias",
        "avaliacoes",
        "parametros",
        "especies",
        "producao",
        "weather",
        "prisma",
        "docker",
        "docs",
        "ci",
        "deps"
      ]
    ],
    // Escopo é opcional (não obrigatório)
    "scope-empty": [0],
    // Cabeçalho: máximo 100 caracteres
    "header-max-length": [2, "always", 100]
  }
};
