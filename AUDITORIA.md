# Auditoria — Target Hunter (gerenciador de trades)

Data: 2026-09-19
Escopo: app Next.js client-side (App Router), persistência em `localStorage`,
preços via API pública do CoinGecko. Sem backend próprio.

Este documento registra o que foi encontrado ao ler o código inteiro
(`lib/`, `hooks/`, `components/`, `app/`) e o arquivo de exemplo
`trades.json` fornecido, e o que foi corrigido nesta rodada. Achados sem
"[CORRIGIDO]" ficam documentados como risco conhecido — corrigi-los exigiria
mudanças de escopo maior (ver `MELHORIAS.md`).

## Resumo executivo

O sistema funciona e as regras de negócio (targets T1/T2/T3, recompra,
stop loss manual, withdraw) estão implementadas de forma coerente. Os
problemas mais sérios encontrados foram:

1. Um bug funcional real: o botão de **restaurar oportunidade de recompra
   ignorada** nunca funcionava (código morto).
2. **Importar um backup substituía todos os dados sem validação e sem
   qualquer forma de desfazer** — um arquivo levemente corrompido apagava o
   histórico de trades da pessoa.
3. Ações de mutação de trades liam o estado React (`trades`) fechado em
   closures de `useCallback`, criando uma janela real de **lost update**
   entre ações disparadas em sequência rápida.
4. Erros de ponto flutuante se acumulavam nas quantidades (visíveis no
   `trades.json` de exemplo: `0.129550470805`, `4.2097e-7`, etc.), sem
   nenhum arredondamento na escrita.
5. `usePrices` podia refazer a chamada à API do CoinGecko a cada ação do
   usuário (qualquer trade adicionado/editado), por causa de uma
   dependência de array instável — arriscado contra o rate limit da API
   pública.

Todos os itens acima foram corrigidos nesta rodada (ver detalhes e
commits). Também foram adicionados testes automatizados (`pnpm test`,
Vitest) cobrindo a lógica pura de cálculo, recompra e validação de import,
para que essas regras não voltem a quebrar silenciosamente.

## Achados

### 1. [CORRIGIDO] Restaurar recompra ignorada nunca funcionava

`components/trades/rebuy-alerts.tsx` tinha, dentro do mesmo laço:

```ts
if (realization.rebuyStatus === 'DISMISSED') continue   // sai do loop aqui...
...
if (realization.rebuyStatus === 'DISMISSED') {
  dismissedAlerts.push(alert)   // ...nunca chega aqui
}
```

O `continue` antecipado descartava a realização antes do segundo `if` ser
avaliado, então `dismissedAlerts` nunca era populado. Resultado prático: a
seção "Oportunidades Ignoradas" nunca aparecia, e não havia como reverter
um "Ignorar" feito por engano nessa tela — mesmo a pessoa querendo, o botão
de restaurar simplesmente não existia na UI, apesar de `onRestoreRebuy`
estar implementado e funcional no hook.

**Correção**: a lógica de filtragem foi extraída para uma função pura,
`computeRebuyAlerts` (`lib/rebuy.ts`), coberta por testes unitários
(`lib/__tests__/rebuy.test.ts`, incluindo um teste de regressão específico
para este bug). O componente agora só faz renderização.

### 2. [CORRIGIDO] Importação de JSON sem validação nem backup

`lib/storage.ts#importData` fazia:

```ts
const data = JSON.parse(jsonString) as Partial<ExportedData>
const trades = Array.isArray(data.trades) ? data.trades : []
...
saveTrades(trades)  // sobrescreve tudo, sem confirmação, sem backup
```

Problemas:
- Qualquer campo com o tipo errado (`amount` como string, `entryPrice`
  ausente, `realizations` faltando) entrava direto no estado da aplicação e
  só quebrava mais tarde, em algum cálculo, de forma difícil de rastrear.
- Se `data.trades` não fosse um array (arquivo errado, versão futura do
  schema, JSON truncado), a importação **zerava silenciosamente todos os
  trades** — sem aviso, sem confirmação, sem backup.
- Não havia diálogo de confirmação antes de uma operação claramente
  destrutiva (substituir 100% dos dados).
- O próprio arquivo de exemplo enviado tem um `ledgerId` corrompido em um
  trade de TAO (`"c9939393-401d-4909-b1d9-cb8ff82b129J"` — termina em `J`,
  não é um UUID válido, não bate com nenhum `ledger[].id`), o que mostra
  que dados inconsistentes já circulam nos backups reais gerados pelo
  próprio app.

**Correção**:
- `lib/schema.ts`: schema Zod completo para `Trade`, `Realization`,
  `LedgerEntry` e `Settings`. `importData` agora valida antes de tocar em
  qualquer coisa e retorna `{ success, errors }` em vez de lançar/mutar
  silenciosamente.
- Um backup automático do estado atual é salvo (`lib/storage.ts#createBackup`)
  antes de qualquer importação bem-sucedida.
- Nova seção **Backups** em Configurações lista os últimos 10 snapshots e
  permite restaurar qualquer um deles.
- A sidebar agora pede confirmação explícita ("Substituir todos os dados?")
  antes de importar, e mostra o primeiro erro de validação em caso de
  arquivo inválido, sem alterar nada.

### 3. [CORRIGIDO] Lost update entre ações de trade (stale closure)

`hooks/use-trade-actions.ts` recebia `trades` como argumento (o estado React
do último render) e todas as mutações (`addTrade`, `addRealization`,
`deleteTrade`, `update`, ...) partiam desse array fechado em `useCallback`.
Se duas ações fossem disparadas antes de o React re-renderizar — por
exemplo, uma resposta assíncrona de outro componente, ou dois cliques em
sequência — a segunda leria o array desatualizado e sua `persist(...)`
sobrescreveria a mudança da primeira.

**Correção**: toda mutação agora lê o estado atual diretamente de
`getTradeLedgerState()` (fonte de verdade em `localStorage`) em vez do
`trades` fechado no closure. `trades` continua sendo devolvido pelo hook
apenas para renderização.

### 4. [CORRIGIDO] Deriva de ponto flutuante em quantidades

O `trades.json` de exemplo mostra o sintoma claramente — quantidades como
`0.129550470805` ou taxas como `4.2097e-7` — resultado de subtrações
sucessivas em `float64` sem nenhum arredondamento (`quantity - fee -
Σrealizations`). Com trades de longa duração e várias realizações
parciais, o "saldo restante" nunca chega exatamente a zero mesmo quando
deveria (poeira residual positiva ou negativa).

**Correção**: `lib/precision.ts` adiciona `roundQuantity` (8 casas,
padrão de cripto) e `roundCurrency` (2 casas). Aplicado em
`getRemainingQuantity` (`lib/trade-operations.ts`) e nos valores
monetários gerados em `addTrade`/`addRealization`
(`hooks/use-trade-actions.ts`). Um "vender tudo que resta" agora zera de
fato o saldo (testado em `lib/__tests__/trade-operations.test.ts`).

### 5. [CORRIGIDO] `usePrices` podia refazer fetch a cada ação do usuário

```ts
const fetchPrices = useCallback(..., [coinIds])       // coinIds é um array
useEffect(() => { fetchPrices(); setInterval(...) }, [fetchPrices])
```

Como `coinIds` chegava como array literal em pelo menos um dos chamadores
(`app/(dashboard)/page.tsx` usa `useMemo` corretamente, mas o hook não
garantia isso para todo chamador, e a lista de moedas do dashboard também
recalculava a cada nova referência de `trades`), o array tinha uma nova
identidade a cada render em que a lista de trades mudava — o que inclui
qualquer edição não relacionada a moedas. Isso reiniciava o efeito, o que
reinicia o `setInterval` e dispara uma nova chamada imediata à API pública
do CoinGecko, que tem rate limit agressivo (o app já trata `429`/erro de
rede caindo em `catch`, mas cada chamada desnecessária aumenta a chance de
ser bloqueado justamente quando o usuário mais precisa do preço
atualizado).

**Correção**: `usePrices` agora deriva uma chave estável
(`[...new Set(coinIds)].sort().join(',')`) e usa essa string como
dependência real do efeito, além de um guard (`inFlightRef`) para nunca ter
duas chamadas simultâneas em voo.

### 6. Risco conhecido, não corrigido — fee ignorado no cálculo de lucro/ROI

`calculateProfit`/`getRealizationProfit` calculam
`(exitPrice - trade.entryPrice) * quantity` usando sempre o preço de
entrada nominal. A taxa de entrada (`trade.fee`, em unidades do ativo)
reduz a quantidade líquida recebida mas **não é somada ao custo por
unidade** nesse cálculo — ou seja, o lucro exibido por realização é
levemente otimista (o preço médio "real" pago pelas moedas restantes é
`entryPrice * quantity / (quantity - fee)`, ligeiramente maior que
`entryPrice`). Para as taxas do arquivo de exemplo (~0,1%) o efeito é
pequeno, mas é sistemático.

Não corrigido nesta rodada porque mudaria retroativamente todos os valores
de lucro já exibidos/exportados para o usuário, sem uma conversa explícita
sobre isso — ver proposta de correção opcional em `MELHORIAS.md`.

### 7. Risco conhecido — Stop Loss é só um lembrete visual, nunca "executa" sozinho

`TargetStopLoss.status` tem os valores `ATIVO | EXECUTADO | ENCERRADO`, mas
nenhum lugar do código transiciona um stop loss para `EXECUTADO`
automaticamente quando o preço cruza o gatilho — a UI apenas destaca
visualmente (`stopLossTriggered`) quando `currentPrice <= stopLoss.price`.
`ENCERRADO` é setado quando *qualquer* realização é registrada para aquele
target, mesmo que não tenha sido por causa do stop loss. Isso é esperado
para uma ferramenta 100% client-side sem acesso a uma exchange (não dá
para executar ordens de verdade a partir do navegador), mas vale deixar
explícito: o stop loss aqui é um **alerta**, não uma proteção automática.
Nada foi alterado aqui; ver proposta de melhoria (execução assistida via
notificação) em `MELHORIAS.md`.

### 8. Risco conhecido — sem confirmação double-check em ações destrutivas de dados fora do import

Excluir um trade ou uma realização já tem `AlertDialog` de confirmação (bom).
O que faltava era exatamente na importação (item 2, corrigido). Reset de
configurações (`resetToDefaults`) não tem confirmação — é de baixo risco
(reseta só `targets`/`currency`/`theme`, não toca em trades), então não foi
alterado.

### 9. Observação de qualidade — script `lint` quebrado

`package.json` tem `"lint": "eslint ."`, mas o projeto nunca teve um
`eslint.config.js`/`.eslintrc`, então o comando falha imediatamente com
"ESLint couldn't find a configuration file". Tentei adicionar uma
configuração mínima baseada em `eslint-config-next`, mas a versão do
ESLint disponível neste ambiente (9.x) tem um conflito conhecido de
serialização circular com o preset de compatibilidade legado do Next
16.2.0 nesta combinação de versões. Reverti a tentativa para não deixar o
repositório com uma dependência extra que não funciona. Recomendação:
resolver isso separadamente, escolhendo a combinação de versões de
`eslint`/`eslint-config-next` testada pelo time (ou trocar por Biome).

## O que foi adicionado para sustentar a robustez

- **Testes automatizados** (`pnpm test`, Vitest): 23 testes cobrindo
  `lib/calculations.ts`, `lib/trade-operations.ts`, `lib/rebuy.ts`
  (incluindo o teste de regressão do bug #1) e `lib/schema.ts`
  (incluindo o teste de regressão do bug #2).
- **Validação de fronteira** (`lib/schema.ts`, Zod): tudo que entra via
  import de arquivo passa por validação explícita antes de tocar em
  `localStorage`.
- **Backups automáticos** (`lib/storage.ts`, UI em Configurações):
  snapshot antes de qualquer import, com histórico dos últimos 10 e opção
  de restaurar.
- **Arredondamento monetário/quantidade consistente**
  (`lib/precision.ts`).
- Todas as mudanças foram validadas com `pnpm build` (build de produção
  limpo) e checagem manual no navegador (dashboard, detalhe de trade,
  histórico e configurações renderizando corretamente com os dados de
  exemplo fornecidos).
