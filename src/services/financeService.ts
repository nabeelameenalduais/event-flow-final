import { supabase } from "../lib/supabase"
import { isMissingRelation } from "../lib/supabaseErrors"
import { sendNotification } from "./notificationService"
import { getAdminUserIds } from "./userService"
import type {
  Attachment,
  Currency,
  Expense,
  ExpenseStatus,
  FinanceSummary,
  FundTransfer,
  FundingScope,
  FundingSource,
} from "../types"

function mapCurrency(row: Record<string, any>): Currency {
  return {
    code: row.code,
    name: row.name,
    symbol: row.symbol ?? "",
    ratePerUsd: Number(row.rate_per_usd ?? 1),
    ratePerYer: Number(row.rate_per_yer ?? 0),
    isActive: row.is_active ?? true,
    updatedBy: row.updated_by ?? undefined,
    updatedAt: row.updated_at,
  }
}

function mapAttachments(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({ name: String(item.name ?? "Attachment"), url: String(item.url ?? ""), size: item.size }))
}

function mapFunding(row: Record<string, any>): FundingSource {
  return {
    id: row.id,
    name: row.name,
    funderName: row.funder_name ?? "",
    scope: row.scope,
    eventId: row.event_id ?? undefined,
    projectName: row.project_name ?? "",
    currencyCode: row.currency_code,
    amount: Number(row.amount ?? 0),
    ratePerUsd: Number(row.rate_per_usd ?? 1),
    amountUsd: Number(row.amount_usd ?? 0),
    receivedAt: row.received_at,
    method: row.method ?? "",
    reference: row.reference ?? "",
    attachments: mapAttachments(row.attachments),
    notes: row.notes ?? "",
    status: row.status ?? "active",
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

function mapExpense(row: Record<string, any>): Expense {
  return {
    id: row.id,
    eventId: row.event_id ?? undefined,
    fundingId: row.funding_id ?? undefined,
    currencyCode: row.currency_code,
    ratePerUsd: Number(row.rate_per_usd ?? 1),
    amount: Number(row.amount ?? 0),
    amountUsd: Number(row.amount_usd ?? 0),
    beneficiary: row.beneficiary,
    purpose: row.purpose,
    category: row.category ?? "other",
    paymentMethod: row.payment_method ?? "",
    expenseDate: row.expense_date,
    attachments: mapAttachments(row.attachments),
    status: row.status,
    requestedBy: row.requested_by ?? undefined,
    approvedBy: row.approved_by ?? undefined,
    approvedAt: row.approved_at ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
  }
}

function mapTransfer(row: Record<string, any>): FundTransfer {
  return {
    id: row.id,
    fundingId: row.funding_id,
    type: row.type,
    amount: Number(row.amount ?? 0),
    currencyCode: row.currency_code,
    ratePerUsd: Number(row.rate_per_usd ?? 1),
    amountUsd: Number(row.amount_usd ?? 0),
    toFundingId: row.to_funding_id ?? undefined,
    refundTo: row.refund_to ?? "",
    notes: row.notes ?? "",
    attachments: mapAttachments(row.attachments),
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
  }
}

export function toUsd(amount: number, ratePerUsd: number): number {
  if (!Number.isFinite(amount)) return 0
  const rate = Number.isFinite(ratePerUsd) && ratePerUsd > 0 ? ratePerUsd : 1
  return Math.round((amount / rate) * 100) / 100
}

export function formatMoney(amount: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

export async function getCurrencies(includeInactive = true): Promise<Currency[]> {
  let query = supabase.from("currencies").select("*").order("code")
  if (!includeInactive) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error && isMissingRelation(error)) {
    return [
      { code: "USD", name: "US Dollar", symbol: "$", ratePerUsd: 1, ratePerYer: 0.004, isActive: true, updatedAt: "" },
      { code: "YER", name: "Yemeni Rial", symbol: "﷼", ratePerUsd: 250, ratePerYer: 1, isActive: true, updatedAt: "" },
    ]
  }
  if (error) throw error
  return (data ?? []).map(mapCurrency)
}

export async function getCurrency(code: string): Promise<Currency | undefined> {
  const { data, error } = await supabase.from("currencies").select("*").eq("code", code).maybeSingle()
  if (error && isMissingRelation(error)) return undefined
  if (error) throw error
  return data ? mapCurrency(data) : undefined
}

export async function saveCurrency(
  input: { code: string; name: string; symbol?: string; ratePerUsd: number; ratePerYer?: number; isActive?: boolean },
  adminId: string,
): Promise<Currency> {
  const code = input.code.trim().toUpperCase()
  if (!code) throw new Error("Currency code is required")
  if (!(input.ratePerUsd > 0)) throw new Error("Rate must be greater than zero")
  const { data, error } = await supabase
    .from("currencies")
    .upsert(
      {
        code,
        name: input.name.trim() || code,
        symbol: input.symbol ?? "",
        rate_per_usd: input.ratePerUsd,
        rate_per_yer: input.ratePerYer ?? null,
        is_active: input.isActive ?? true,
        updated_by: adminId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    )
    .select()
    .single()
  if (error) throw error
  return mapCurrency(data)
}

export async function getFundingSources(filter?: { scope?: FundingScope; eventId?: string }): Promise<FundingSource[]> {
  let query = supabase.from("funding_sources").select("*").order("received_at", { ascending: false })
  if (filter?.scope) query = query.eq("scope", filter.scope)
  if (filter?.eventId) query = query.eq("event_id", filter.eventId)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapFunding)
}

export interface FundingInput {
  name: string
  funderName?: string
  scope: FundingScope
  eventId?: string
  projectName?: string
  currencyCode: string
  amount: number
  receivedAt?: string
  method?: string
  reference?: string
  attachments?: Attachment[]
  notes?: string
}

export async function createFunding(input: FundingInput, createdBy: string): Promise<FundingSource> {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero")
  const currency = await getCurrency(input.currencyCode)
  const rate = currency?.ratePerUsd ?? 1
  const { data, error } = await supabase
    .from("funding_sources")
    .insert({
      name: input.name,
      funder_name: input.funderName ?? "",
      scope: input.scope,
      event_id: input.scope === "general" ? null : input.eventId || null,
      project_name: input.projectName ?? "",
      currency_code: input.currencyCode,
      amount: input.amount,
      rate_per_usd: rate,
      amount_usd: toUsd(input.amount, rate),
      received_at: input.receivedAt || new Date().toISOString().slice(0, 10),
      method: input.method ?? "",
      reference: input.reference ?? "",
      attachments: input.attachments ?? [],
      notes: input.notes ?? "",
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return mapFunding(data)
}

export async function closeFunding(id: string): Promise<void> {
  const { error } = await supabase.from("funding_sources").update({ status: "closed" }).eq("id", id)
  if (error) throw error
}

export async function getExpenses(filter?: { eventId?: string; status?: ExpenseStatus; fundingId?: string }): Promise<Expense[]> {
  let query = supabase.from("expenses").select("*").order("expense_date", { ascending: false })
  if (filter?.eventId) query = query.eq("event_id", filter.eventId)
  if (filter?.status) query = query.eq("status", filter.status)
  if (filter?.fundingId) query = query.eq("funding_id", filter.fundingId)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapExpense)
}

export interface ExpenseInput {
  eventId?: string
  fundingId?: string
  currencyCode: string
  amount: number
  beneficiary: string
  purpose: string
  category?: string
  paymentMethod?: string
  expenseDate?: string
  attachments?: Attachment[]
}

export async function createExpense(input: ExpenseInput, requestedBy: string): Promise<Expense> {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero")
  if (!input.beneficiary.trim()) throw new Error("Beneficiary is required")
  if (!input.purpose.trim()) throw new Error("Purpose is required")
  const currency = await getCurrency(input.currencyCode)
  const rate = currency?.ratePerUsd ?? 1
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      event_id: input.eventId || null,
      funding_id: input.fundingId || null,
      currency_code: input.currencyCode,
      rate_per_usd: rate,
      amount: input.amount,
      amount_usd: toUsd(input.amount, rate),
      beneficiary: input.beneficiary.trim(),
      purpose: input.purpose.trim(),
      category: input.category ?? "other",
      payment_method: input.paymentMethod ?? "",
      expense_date: input.expenseDate || new Date().toISOString().slice(0, 10),
      attachments: input.attachments ?? [],
      status: "pending",
      requested_by: requestedBy,
    })
    .select()
    .single()
  if (error) throw error

  const expense = mapExpense(data)
  const admins = await getAdminUserIds()
  await Promise.all(
    admins.map((admin) =>
      sendNotification(
        admin.userId,
        "expense_approval",
        `A new expense of ${formatMoney(input.amount, input.currencyCode)} needs approval: ${expense.purpose}.`,
        "/dashboard/finance",
      ).catch(() => undefined),
    ),
  )
  return expense
}

export async function approveExpense(id: string, adminId: string): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .update({ status: "approved", approved_by: adminId, approved_at: new Date().toISOString(), rejection_reason: null })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  const expense = mapExpense(data)
  if (expense.requestedBy) {
    await sendNotification(
      expense.requestedBy,
      "expense_approval",
      `Your expense "${expense.purpose}" was approved.`,
      "/dashboard/finance",
    ).catch(() => undefined)
  }
  return expense
}

export async function rejectExpense(id: string, adminId: string, reason: string): Promise<Expense> {
  const { data, error } = await supabase
    .from("expenses")
    .update({
      status: "rejected",
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", id)
    .select()
    .single()
  if (error) throw error
  const expense = mapExpense(data)
  if (expense.requestedBy) {
    await sendNotification(
      expense.requestedBy,
      "expense_approval",
      `Your expense "${expense.purpose}" was rejected${reason ? `: ${reason}` : "."}`,
      "/dashboard/finance",
    ).catch(() => undefined)
  }
  return expense
}

export async function getFundTransfers(fundingId?: string): Promise<FundTransfer[]> {
  let query = supabase.from("fund_transfers").select("*").order("created_at", { ascending: false })
  if (fundingId) query = query.eq("funding_id", fundingId)
  const { data, error } = await query
  if (error && isMissingRelation(error)) return []
  if (error) throw error
  return (data ?? []).map(mapTransfer)
}

export async function getFundingAvailable(fundingId: string): Promise<{ availableUsd: number; availableOriginal: number; funding?: FundingSource }> {
  const [funding, expenses, transfers] = await Promise.all([
    getFundingSources().then((rows) => rows.find((f) => f.id === fundingId)),
    getExpenses({ fundingId, status: "approved" }),
    getFundTransfers(fundingId),
  ])
  if (!funding) return { availableUsd: 0, availableOriginal: 0 }
  const spent = expenses.reduce((sum, e) => sum + e.amountUsd, 0)
  const moved = transfers.reduce((sum, t) => sum + t.amountUsd, 0)
  const availableUsd = Math.max(0, funding.amountUsd - spent - moved)
  return {
    availableUsd,
    availableOriginal: Math.round(availableUsd * funding.ratePerUsd * 100) / 100,
    funding,
  }
}

export async function createFundTransfer(
  input: {
    fundingId: string
    type: "to_general" | "refund"
    amount: number
    currencyCode: string
    toFundingId?: string
    refundTo?: string
    notes?: string
    attachments?: Attachment[]
  },
  createdBy: string,
): Promise<FundTransfer> {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero")
  const available = await getFundingAvailable(input.fundingId)
  if (!available.funding) throw new Error("Funding source not found")
  const rate = available.funding.ratePerUsd
  const amountUsd = toUsd(input.amount, rate)
  if (amountUsd > available.availableUsd + 0.01) {
    throw new Error(`Only ${formatMoney(available.availableUsd, "USD")} is available in this funding source`)
  }
  const { data, error } = await supabase
    .from("fund_transfers")
    .insert({
      funding_id: input.fundingId,
      type: input.type,
      amount: input.amount,
      currency_code: input.currencyCode,
      rate_per_usd: rate,
      amount_usd: amountUsd,
      to_funding_id: input.toFundingId || null,
      refund_to: input.refundTo ?? "",
      notes: input.notes ?? "",
      attachments: input.attachments ?? [],
      created_by: createdBy,
    })
    .select()
    .single()
  if (error) throw error
  return mapTransfer(data)
}

export async function getFinanceSummary(eventId?: string): Promise<FinanceSummary> {
  const [currencies, funding, expenses, transfers] = await Promise.all([
    getCurrencies(),
    getFundingSources(eventId ? { eventId } : undefined),
    getExpenses(eventId ? { eventId } : undefined),
    getFundTransfers(),
  ])

  const fundingUsd = funding.reduce((sum, f) => sum + f.amountUsd, 0)
  const approvedExpensesUsd = expenses.filter((e) => e.status === "approved").reduce((sum, e) => sum + e.amountUsd, 0)
  const pendingExpensesUsd = expenses.filter((e) => e.status === "pending").reduce((sum, e) => sum + e.amountUsd, 0)

  const fundingIds = new Set(funding.map((f) => f.id))
  const relevantTransfers = transfers.filter((t) => fundingIds.has(t.fundingId))

  // Moving leftovers to the "general pool" is an internal transfer: the source
  // loses the amount and the general pool gains it, so the overall balance is
  // unchanged. Only refunds actually leave the organization.
  const toGeneralTransfers = transfers.filter((t) => t.type === "to_general" && !t.toFundingId)
  const toGeneralUsd = toGeneralTransfers.reduce((sum, t) => sum + t.amountUsd, 0)
  const refundedUsd = relevantTransfers.filter((t) => t.type === "refund").reduce((sum, t) => sum + t.amountUsd, 0)

  const generalFundingUsd =
    funding.filter((f) => f.scope === "general").reduce((sum, f) => sum + f.amountUsd, 0) + toGeneralUsd
  const eventFundingUsd = funding.filter((f) => f.scope !== "general").reduce((sum, f) => sum + f.amountUsd, 0)

  const currencyCodes = [...new Set([...currencies.map((c) => c.code), ...funding.map((f) => f.currencyCode), ...expenses.map((e) => e.currencyCode)])]
  const byCurrency = currencyCodes.map((currency) => {
    const inCurrency = funding.filter((f) => f.currencyCode === currency).reduce((sum, f) => sum + f.amount, 0)
    const spent = expenses
      .filter((e) => e.currencyCode === currency && e.status === "approved")
      .reduce((sum, e) => sum + e.amount, 0)
    // Internal moves to the general pool stay inside the same currency bucket,
    // so they net out by construction. Only refunds leave the organization.
    const refunded = relevantTransfers
      .filter((t) => t.type === "refund" && t.currencyCode === currency)
      .reduce((sum, t) => sum + t.amount, 0)
    return {
      currency,
      funding: Math.round(inCurrency * 100) / 100,
      expenses: Math.round(spent * 100) / 100,
      balance: Math.round((inCurrency - spent - refunded) * 100) / 100,
    }
  })

  return {
    totalFundingUsd: Math.round(fundingUsd * 100) / 100,
    generalFundingUsd: Math.round(generalFundingUsd * 100) / 100,
    eventFundingUsd: Math.round(eventFundingUsd * 100) / 100,
    approvedExpensesUsd: Math.round(approvedExpensesUsd * 100) / 100,
    pendingExpensesUsd: Math.round(pendingExpensesUsd * 100) / 100,
    balanceUsd: Math.round((fundingUsd - approvedExpensesUsd - refundedUsd) * 100) / 100,
    byCurrency,
  }
}
