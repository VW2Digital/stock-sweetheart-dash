---
name: Admin multi-currency display
description: Seletor de moeda BRL/USD/EUR/GBP no painel admin — apenas visual, gateways continuam em BRL
type: feature
---

Switcher fica no header do AdminLayout (`AdminCurrencySwitcher`). Provider: `src/contexts/AdminCurrencyContext.tsx`. Persiste moeda + taxas em `localStorage` (`admin_currency`, `admin_currency_rates`). Taxas editáveis via diálogo (1 BRL = X USD/EUR/GBP), default USD 0.18 / EUR 0.17 / GBP 0.14.

Hook `useAdminCurrency()` expõe `{ currency, setCurrency, rates, setRates, format(brlValue), convert(brlValue), meta }`. Sempre passar o valor em **BRL** para `format`/`convert` — ele converte internamente.

Componentes que usam: `DashboardTopKpis`, `DashboardOverallSummary`, `DashboardSalesOverview`, `DashboardMostRecentProducts`, `ReportsPage`, `OrdersPage`, `OrderDetailPage`.

**Importante:** conversão é puramente visual. Asaas/Mercado Pago/PagBank/Pagar.me só operam em BRL — checkout e webhooks permanecem em BRL.
