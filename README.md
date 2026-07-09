# Voxel Livre

Prototipo sandbox voxel 3D original para navegador, feito com HTML, CSS, JavaScript e Three.js local.

## Como executar

Abra `index.html` no navegador ou rode um servidor local na pasta do projeto:

```bash
python -m http.server 5174
```

Depois acesse:

```text
http://127.0.0.1:5174/
```

Para persistencia no Neon, publique em um ambiente com Netlify Functions e configure:

```text
DATABASE_URL=postgresql://...
```

O schema esta em `sql/neon_schema.sql`. A funcao `/.netlify/functions/progress` tambem cria as tabelas automaticamente se elas nao existirem. Sem essa variavel, o jogo continua funcionando com `localStorage`.

## Controles

- WASD: mover
- Mouse: olhar
- Espaco: pular ou subir no modo criativo
- Ctrl: descer no modo criativo
- Shift: correr/acelerar
- C: alternar modo criativo
- E: abrir ou fechar inventario
- Clique esquerdo: quebrar bloco
- Clique direito: colocar bloco ou comer alimento selecionado
- 1-9: trocar slot da hotbar
- ESC: liberar o mouse

## Recursos

- Login local com nome salvo no navegador
- Persistencia remota opcional no Neon para usuarios e progresso
- Hotbar com 9 slots e inventario com 36 espacos
- Sistema de vida, fome, dano, queda e regeneracao
- Alimentos consumiveis com restauracao de fome
- Mundo voxel procedural por chunks
- Renderizacao apenas de faces visiveis
- Texturas pixeladas originais geradas por codigo
- Blocos de grama, terra, pedra, madeira, folhas e areia
- Arvores simples
- Castelo de Voxelandia gerado proximo ao spawn inicial
- Criaturas voxeladas originais com caminhada, sons e comportamento simples
- Primeira pessoa com colisao, gravidade e pulo
- Modo criativo com voo
- Sons procedurais via Web Audio
- Salvamento local com `localStorage`
