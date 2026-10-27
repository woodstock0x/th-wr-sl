# Melhorias — implementadas e propostas

## Implementada nesta rodada: notificações do navegador

**Problema**: hoje, "alertar" quando um target ou uma oportunidade de
recompra é atingido significa desenhar um card colorido no dashboard. Se a
aba não estiver aberta e em foco, a pessoa simplesmente não vê — em um
mercado de cripto que se move em minutos, isso custa a oportunidade.

**O que foi feito**:
- `lib/notifications.ts`: camada fina sobre a Web Notifications API
  (permissão, disparo).
- `hooks/use-alert-notifications.ts`: observa os trades ativos a cada
  atualização de preço e dispara uma notificação do sistema operacional
  para cada novo target atingido ou nova oportunidade de recompra —
  deduplicado por sessão de página, então não repete a cada refresh de 20
  minutos.
- Nova opção em **Configurações → Notificações do Navegador** (pede
  permissão do navegador, liga/desliga).

**Limitação importante, deixada explícita na UI e aqui**: isso só funciona
com o navegador **aberto** (pode estar em segundo plano/minimizado, mas não
fechado). Não é push de verdade.

## Proposta principal: push de verdade (funciona com o navegador fechado)

Para notificação que chega mesmo com tudo fechado (celular ou desktop),
é necessário:

1. Um **backend mínimo** (mesmo que serverless) que guarde os `trades` e
   `settings` da pessoa e rode um job periódico comparando preço atual x
   targets/gatilhos de recompra — hoje isso só acontece no navegador, então
   se ninguém tiver o app aberto, ninguém verifica.
2. **Web Push + Service Worker**: o navegador registra uma subscription
   (`PushManager`), o backend guarda o endpoint e envia a notificação via
   VAPID quando o job detecta um gatilho.
3. Esse mesmo backend resolve de quebra o problema estrutural maior do
   projeto hoje: **os dados vivem só em `localStorage` de um navegador**.
   Sem backend, não há: acesso do mesmo portfólio em dois dispositivos,
   recuperação se o navegador limpar dados, nem o push acima.

Isso é uma mudança de arquitetura (de app 100% client-side para app com
sincronização), não uma tarde de trabalho — por isso ficou como proposta e
não foi implementada junto com o resto desta auditoria. Dado que o dado
mais crítico aqui é histórico financeiro pessoal, sugiro como próximo passo
natural do produto, não obrigatório para ele continuar funcionando como
está hoje.

## Outras melhorias propostas (não implementadas, ordenadas por impacto)

1. **Corrigir o custo médio para incluir a taxa de entrada** (achado #6 da
   auditoria). É uma mudança pequena em `lib/calculations.ts`, mas muda os
   números de lucro já mostrados para o usuário — melhor decidir isso numa
   conversa direta ("quero o número mais preciso, mesmo que mude o
   histórico exibido?") do que trocar silenciosamente.
2. **Modo "preços em cache" quando a API do CoinGecko falha/limita**:
   guardar o último preço bem-sucedido por moeda em `localStorage` e
   mostrar com um indicador "desatualizado há Xmin" em vez de cair para
   `entryPrice` (que faz o ROI parecer zero quando na real é só falta de
   dado).
3. **Chave de API do CoinGecko (Demo/Pro) opcional nas Configurações**: a
   API pública sem chave tem rate limit bem mais apertado; com o número de
   moedas do portfólio de exemplo (11 moedas distintas), qualquer pico de
   uso de outras abas/usuários pode gerar 429 facilmente.
4. **Exportação CSV/planilha do histórico** (além do JSON de backup atual),
   para declaração de imposto de renda — hoje só existe JSON bruto.
5. **Reconciliação de saldo do ledger**: hoje `cashBalance` é a soma bruta
   de todo o `ledger` (entradas de trade, realizações e withdraws
   juntos). Um pequeno painel em Configurações ou Withdraw mostrando a
   composição desse saldo (quanto veio de realizações vs. quanto já foi
   sacado) ajudaria a auditar o próprio caixa visualmente.
6. **Testes de interação (Playwright) além dos testes de unidade**: os
   testes adicionados nesta rodada cobrem a lógica pura; um pequeno
   conjunto de testes de fluxo (criar trade → realizar T1 → recomprar)
   pegaria regressões de integração entre hooks e UI que testes unitários
   não veem.
