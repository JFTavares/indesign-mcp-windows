# Estudo e decisões da adaptação

Origem: https://github.com/lucdesign/indesign-mcp-server

Commit: `3e3f367634ff761455dcce06222b6e581fd8b7b3`.

O original tem 51 ferramentas em um único arquivo JavaScript. Quase toda a lógica gera ExtendScript, compartilhado pelo InDesign no macOS e no Windows. A parte específica de macOS estava em `executeAppleScript`/`executeInDesignScript`, usando `osascript`, aplicativo com versão fixa e arquivos temporários compartilhados.

## Implementação

- Mantida a interface MCP e atualizada a dependência SDK para a série 1.x, com versão resolvida no lockfile.
- Substituído AppleScript por Windows PowerShell 5.1 em STA, chamando COM. A linguagem `1246973031` é [ScriptLanguage.JAVASCRIPT](https://developer.adobe.com/indesign/dom/api/s/ScriptLanguage/).
- PowerShell recebe somente argumentos de arquivo/ProgID. Código de usuário não é concatenado em comandos de shell. Node usa `execFile`, com janela oculta.
- A ponte conecta à instância registrada ou inicia o InDesign. Não fecha o aplicativo ao liberar o objeto COM.
- Diretório temporário exclusivo por chamada; scripts e respostas UTF-8. O cabeçalho de resposta aceita CRLF e LF.
- Captura do valor de conclusão via `eval` no ExtendScript, preservando retornos dentro de `if`/`try`, em vez da heurística da última linha do original.
- Fila de chamadas por processo. Um timeout deixa o estado incerto e bloqueia novas chamadas até reiniciar o servidor; nunca reexecuta uma mutação automaticamente.
- Validação de argumentos MCP por JSON Schema. Os erros operacionais retornam `isError`, incluindo mensagens de erro capturadas pelo código legado.
- Caminhos absolutos, separador `;`, normalização de barras e resolução de links existentes.
- Conservada a licença MIT e a atribuição original.

## Correções observadas em execução real

1. Acesso a `doc.fullName` falha para documentos não salvos; consultar `doc.saved` primeiro.
2. `Table.rowCount` não é suportado. Criação usa `bodyRowCount`, cabeçalhos e rodapés; leitura usa `rows.length`/`columns.length`.
3. PDF usava propriedades inexistentes. A adaptação usa `useDocumentBleedWithPDF`, `includeSlugWithPDF` e `CompressionQuality`, conforme [PDFExportPreference](https://developer.adobe.com/indesign/dom/api/p/PDFExportPreference/).
4. Nomes de predefinições variam por idioma. Aliases PT/EN e nomes exatos substituem o fallback silencioso para a primeira predefinição.
5. O InDesign pode converter aspas retas em tipográficas conforme suas preferências; o teste permite essa conversão nativa.

## Limites da validação

Ambiente: Windows, Node.js 24.14.1, InDesign 21.6.0.57 em português. Protocolo MCP validado com cliente SDK real sobre stdio; ponte COM validada no aplicativo instalado. O teste completo fica em `scripts/smoke-indesign.js` e os resultados são gravados em `artifacts/`.

Listar 51 ferramentas e validar a sintaxe dos scripts não demonstra cobertura funcional de todas elas. Exportação EPUB/imagens, data merge, empacotamento, preflight e todos os modos tipográficos não estão certificados. Configurações globais dos clientes MCP não são alteradas automaticamente.
