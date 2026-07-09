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

## Controles

- WASD: mover
- Mouse: olhar
- Espaco: pular ou subir no modo criativo
- Ctrl: descer no modo criativo
- Shift: correr/acelerar
- C: alternar modo criativo
- Clique esquerdo: quebrar bloco
- Clique direito: colocar bloco
- 1-6: trocar bloco selecionado
- ESC: liberar o mouse

## Recursos

- Mundo voxel procedural por chunks
- Renderizacao apenas de faces visiveis
- Texturas pixeladas originais geradas por codigo
- Blocos de grama, terra, pedra, madeira, folhas e areia
- Arvores simples
- Primeira pessoa com colisao, gravidade e pulo
- Modo criativo com voo
- Sons procedurais via Web Audio
- Salvamento local com `localStorage`
