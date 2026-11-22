import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import {
  Wallet, Plus, Check, X, Coins, ArrowRightLeft, Receipt, Paperclip, Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Badge } from "../components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { useAuth } from "../contexts/AuthContext"
import {
  getFinanceSummary,
  getCurrencies,
  saveCurrency,
  getFundingSources,
  createFunding,
  getExpenses,
  createExpense,
  approveExpense,
  rejectExpense,
  getFundTransfers,
  createFundTransfer,
  getFundingAvailable,
  formatMoney,
  type ExpenseInput,
} from "../services/financeService"
import { getEventsForUser } from "../services/eventService"
import { EXPENSE_CATEGORIES } from "../constants"
import type { Attachment, Currency, Event, Expense, FundingScope, FundingSource } from "../types"

export function Finance() {
  const { t } = useLanguage()
  
  const { user, profile, role } = useAuth()
  const isAdmin = role === "admin"
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getFinanceSummary>> | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [funding, setFunding] = useState<FundingSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [transfers, setTransfers] = useState<Awaited<ReturnType<typeof getFundTransfers>>>([])
  const [events, setEvents] = useState<Event[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, c, f, e, transfersData] = await Promise.all([
        getFinanceSummary(),
        getCurrencies(),
        getFundingSources(),
        getExpenses(),
        getFundTransfers(),
      ])
      setSummary(s)
      setCurrencies(c)
      setFunding(f)
      setExpenses(e)
      setTransfers(transfersData)
      if (profile && user) {
        const ev = await getEventsForUser(profile.id, user.id, role ?? "attendee", profile.managesAllEvents ?? false)
        setEvents(ev)
      }
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to load finance data"))
    } finally {
      setLoading(false)
    }
  }, [profile, role, user])

  useEffect(() => { load() }, [load])

  if (loading) return <Loading text={t("Loading finance...")} />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet size={24} /> {t("Finance")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("Multi-currency funding, expenses and approvals. USD is the consolidation base; every transaction keeps the rate used at the time.")}
          {!isAdmin && ` ${t("Administrators approve expenses and manage currencies and funding.")}`}
        </p>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat title={t("Total funding")} value={formatMoney(summary.totalFundingUsd, "USD")} hint={t("Consolidated in USD")} />
          <Stat title={t("Approved expenses")} value={formatMoney(summary.approvedExpensesUsd, "USD")} hint={`${formatMoney(summary.pendingExpensesUsd, "USD")} pending`} />
          <Stat title={t("Balance")} value={formatMoney(summary.balanceUsd, "USD")} hint={t("Funding − approved expenses − transfers")} />
          <Stat title={t("General / event")} value={`${formatMoney(summary.generalFundingUsd, "USD")} / ${formatMoney(summary.eventFundingUsd, "USD")}`} hint={t("Pool split")} />
        </div>
      )}

      <Tabs defaultValue="funding">
        <TabsList className="flex-wrap">
          <TabsTrigger value="funding">{t("Funding")}</TabsTrigger>
          <TabsTrigger value="expenses">{t("Expenses")}</TabsTrigger>
          {isAdmin && <TabsTrigger value="currencies">{t("Currencies")}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="transfers">{t("Transfers")}</TabsTrigger>}
        </TabsList>

        <TabsContent value="funding" className="mt-4 space-y-4">
          {isAdmin && <FundingForm currencies={currencies} events={events} userId={user?.id ?? ""} onSaved={load} />}
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Funding sources (")}{funding.length})</CardTitle></CardHeader>
            <CardContent>
              {funding.length === 0 ? (
                <EmptyState title={t("No funding recorded")} description={t("Add general or event-designated funding.")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Name")}</TableHead>
                      <TableHead>{t("Funder")}</TableHead>
                      <TableHead>{t("Scope")}</TableHead>
                      <TableHead>{t("Amount")}</TableHead>
                      <TableHead>USD</TableHead>
                      <TableHead>{t("Received")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {funding.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium text-sm">{f.name}</TableCell>
                        <TableCell className="text-sm">{f.funderName || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {f.scope === "general" ? t("General pool") : events.find((e) => e.id === f.eventId)?.title ?? f.scope}
                        </TableCell>
                        <TableCell className="text-sm">{formatMoney(f.amount, f.currencyCode)}</TableCell>
                        <TableCell className="text-sm">{formatMoney(f.amountUsd, "USD")}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(f.receivedAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="mt-4 space-y-4">
          <ExpenseForm currencies={currencies} events={events} funding={funding} userId={user?.id ?? ""} onSaved={load} />
          <Card>
            <CardHeader><CardTitle className="text-base">{t("Expenses (")}{expenses.length})</CardTitle></CardHeader>
            <CardContent>
              {expenses.length === 0 ? (
                <EmptyState title={t("No expenses")} description={t("Expense requests and approved spending appear here.")} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Purpose")}</TableHead>
                      <TableHead>{t("Beneficiary")}</TableHead>
                      <TableHead>{t("Event")}</TableHead>
                      <TableHead>{t("Amount")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead className="text-right">{t("Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{expense.purpose}</p>
                          <p className="text-xs text-muted-foreground capitalize">{t(expense.category.replace("_", " "))}{expense.attachments.length > 0 ? ` · ${expense.attachments.length} attachment(s)` : ""}</p>
                        </TableCell>
                        <TableCell className="text-sm">{expense.beneficiary}</TableCell>
                        <TableCell className="text-sm">{events.find((e) => e.id === expense.eventId)?.title ?? "General"}</TableCell>
                        <TableCell className="text-sm">
                          {formatMoney(expense.amount, expense.currencyCode)}
                          <span className="block text-xs text-muted-foreground">≈ {formatMoney(expense.amountUsd, "USD")}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={expense.status === "approved" ? "default" : expense.status === "rejected" ? "destructive" : "secondary"}>
                            {t(expense.status)}
                          </Badge>
                          {expense.rejectionReason && <p className="text-xs text-destructive mt-1">{expense.rejectionReason}</p>}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && expense.status === "pending" && (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="text-green-600 gap-1" onClick={async () => {
                                if (!user) return
                                await approveExpense(expense.id, user.id)
                                toast.success(t("Expense approved"))
                                load()
                              }}>
                                <Check size={14} />  {t("Approve")}
                              </Button>
                              <Button size="sm" variant="ghost" className="text-destructive gap-1" onClick={async () => {
                                if (!user) return
                                const reason = window.prompt(t("Rejection reason:")) ?? ""
                                await rejectExpense(expense.id, user.id, reason)
                                toast.success(t("Expense rejected"))
                                load()
                              }}>
                                <X size={14} />  {t("Reject")}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="currencies" className="mt-4 space-y-4">
            <CurrencyForm adminId={user?.id ?? ""} onSaved={load} />
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Currencies")}</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Code")}</TableHead>
                      <TableHead>{t("Name")}</TableHead>
                      <TableHead>{t("Per USD")}</TableHead>
                      <TableHead>{t("Per YER")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((c) => (
                      <TableRow key={c.code}>
                        <TableCell className="font-medium">{c.code}</TableCell>
                        <TableCell className="text-sm">{c.name}</TableCell>
                        <TableCell className="text-sm">{c.ratePerUsd}</TableCell>
                        <TableCell className="text-sm">{c.ratePerYer || "—"}</TableCell>
                        <TableCell><Badge variant={c.isActive ? "default" : "outline"}>{c.isActive ? t("active") : t("inactive")}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="transfers" className="mt-4 space-y-4">
            <TransferForm funding={funding} currencies={currencies} userId={user?.id ?? ""} onSaved={load} />
            <Card>
              <CardHeader><CardTitle className="text-base">{t("Transfers & refunds (")}{transfers.length})</CardTitle></CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <EmptyState title={t("No transfers")} description={t("Leftover funding moved to the general pool or refunded appears here.")} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("Type")}</TableHead>
                        <TableHead>{t("Funding")}</TableHead>
                        <TableHead>{t("Amount")}</TableHead>
                        <TableHead>{t("Target")}</TableHead>
                        <TableHead>{t("Date")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map((transfer) => (
                        <TableRow key={transfer.id}>
                          <TableCell><Badge variant="outline">{transfer.type === "to_general" ? t("To general pool") : t("Refund")}</Badge></TableCell>
                          <TableCell className="text-sm">{funding.find((f) => f.id === transfer.fundingId)?.name ?? t("—")}</TableCell>
                          <TableCell className="text-sm">{formatMoney(transfer.amount, transfer.currencyCode)}</TableCell>
                          <TableCell className="text-sm">{transfer.type === "to_general" ? funding.find((f) => f.id === transfer.toFundingId)?.name ?? t("General pool") : transfer.refundTo || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(transfer.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
}

function AttachmentEditor({ value, onChange }: { value: Attachment[]; onChange: (next: Attachment[]) => void }) {
  const { t } = useLanguage()
  
  const [name, setName] = useState("")
  const [url, setUrl] = useState("")

  const add = () => {
    if (!name.trim() || !url.trim()) return
    onChange([...value, { name: name.trim(), url: url.trim() }])
    setName("")
    setUrl("")
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium">{t("Attachments")}</label>
      {value.length > 0 && (
        <div className="space-y-1">
          {value.map((a, i) => (
            <div key={`${a.url}-${i}`} className="flex items-center gap-2 text-sm rounded border border-border px-2 py-1">
              <Paperclip size={13} />
              <span className="flex-1 truncate">{a.name}</span>
              <button type="button" className="text-destructive" onClick={() => onChange(value.filter((_, idx) => idx !== i))}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("File name")} />
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://link-to-file" />
        <Button type="button" variant="outline" onClick={add}>{t("Add")}</Button>
      </div>
    </div>
  )
}

function FundingForm({ currencies, events, userId, onSaved }: { currencies: Currency[]; events: Event[]; userId: string; onSaved: () => void }) {
  const { t } = useLanguage()
  
  const [name, setName] = useState("")
  const [funderName, setFunderName] = useState("")
  const [scope, setScope] = useState<FundingScope>("general")
  const [eventId, setEventId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")
  const [amount, setAmount] = useState("")
  const [receivedAt, setReceivedAt] = useState("")
  const [method, setMethod] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createFunding({
        name,
        funderName,
        scope,
        eventId: scope === "general" ? undefined : eventId,
        currencyCode,
        amount: Number(amount),
        receivedAt: receivedAt || undefined,
        method,
        reference,
        notes,
        attachments,
      }, userId)
      toast.success(t("Funding recorded"))
      setName(""); setAmount(""); setReference(""); setNotes(""); setAttachments([])
      onSaved()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to record funding"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Coins size={16} /> {t("Add funding")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Funding name")} required />
            <Input value={funderName} onChange={(e) => setFunderName(e.target.value)} placeholder={t("Funder name")} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={scope} onChange={(e) => setScope(e.target.value as FundingScope)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="general">{t("General pool")}</option>
              <option value="event">{t("Event-designated")}</option>
              <option value="project">{t("Project")}</option>
            </select>
            {scope !== "general" && (
              <select value={eventId} onChange={(e) => setEventId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
                <option value="">{t("Select event")}</option>
                {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            )}
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} {t("—")} {c.name}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("Amount")} required />
            <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
            <Input value={method} onChange={(e) => setMethod(e.target.value)} placeholder={t("Method (bank, cash...)")} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder={t("Reference / receipt no.")} />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Notes")} />
          </div>
          <AttachmentEditor value={attachments} onChange={setAttachments} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2"><Plus size={15} /> {saving ? t("Saving...") : t("Add funding")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ExpenseForm({ currencies, events, funding, userId, onSaved }: { currencies: Currency[]; events: Event[]; funding: FundingSource[]; userId: string; onSaved: () => void }) {
  const { t } = useLanguage()
  
  const [eventId, setEventId] = useState("")
  const [fundingId, setFundingId] = useState("")
  const [currencyCode, setCurrencyCode] = useState("USD")
  const [amount, setAmount] = useState("")
  const [beneficiary, setBeneficiary] = useState("")
  const [purpose, setPurpose] = useState("")
  const [category, setCategory] = useState<string>("other")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [expenseDate, setExpenseDate] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const input: ExpenseInput = {
        eventId: eventId || undefined,
        fundingId: fundingId || undefined,
        currencyCode,
        amount: Number(amount),
        beneficiary,
        purpose,
        category,
        paymentMethod,
        expenseDate: expenseDate || undefined,
        attachments,
      }
      await createExpense(input, userId)
      toast.success(t("Expense submitted for approval"))
      setAmount(""); setBeneficiary(""); setPurpose(""); setAttachments([])
      onSaved()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to submit the expense"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Receipt size={16} /> {t("New expense request")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={eventId} onChange={(e) => setEventId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">{t("General (no event)")}</option>
              {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            <select value={fundingId} onChange={(e) => setFundingId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">{t("Unassigned funding")}</option>
              {funding.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm capitalize">
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
            </select>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("Amount")} required />
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} placeholder={t("Beneficiary")} required />
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder={t("Payment method")} />
          </div>
          <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} required
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm" placeholder={t("Purpose of the expense")} />
          <AttachmentEditor value={attachments} onChange={setAttachments} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="gap-2"><Plus size={15} /> {saving ? t("Submitting...") : t("Submit expense")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function CurrencyForm({ adminId, onSaved }: { adminId: string; onSaved: () => void }) {
  const { t } = useLanguage()
  
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [symbol, setSymbol] = useState("")
  const [ratePerUsd, setRatePerUsd] = useState("")
  const [ratePerYer, setRatePerYer] = useState("")
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await saveCurrency(
        { code, name, symbol, ratePerUsd: Number(ratePerUsd), ratePerYer: ratePerYer ? Number(ratePerYer) : undefined },
        adminId,
      )
      toast.success(t("Currency saved"))
      setCode(""); setName(""); setSymbol(""); setRatePerUsd(""); setRatePerYer("")
      onSaved()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to save the currency"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("Add or update a currency")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid sm:grid-cols-5 gap-3 items-end">
          <div><label className="block text-xs font-medium mb-1">{t("Code")}</label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="EUR" required maxLength={5} /></div>
          <div><label className="block text-xs font-medium mb-1">{t("Name")}</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Euro")} /></div>
          <div><label className="block text-xs font-medium mb-1">{t("Symbol")}</label><Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="€" /></div>
          <div><label className="block text-xs font-medium mb-1">{t("Units per USD")}</label><Input type="number" min={0} step="0.0001" value={ratePerUsd} onChange={(e) => setRatePerUsd(e.target.value)} required /></div>
          <div><label className="block text-xs font-medium mb-1">{t("Units per YER")}</label><Input type="number" min={0} step="0.0001" value={ratePerYer} onChange={(e) => setRatePerYer(e.target.value)} /></div>
          <div className="sm:col-span-5 flex justify-end">
            <Button type="submit" disabled={saving}>{saving ? t("Saving...") : t("Save currency")}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function TransferForm({ funding, currencies, userId, onSaved }: { funding: FundingSource[]; currencies: Currency[]; userId: string; onSaved: () => void }) {
  const { t } = useLanguage()
  
  const [fundingId, setFundingId] = useState("")
  const [type, setType] = useState<"to_general" | "refund">("to_general")
  const [amount, setAmount] = useState("")
  const [refundTo, setRefundTo] = useState("")
  const [notes, setNotes] = useState("")
  const [available, setAvailable] = useState<{ availableUsd: number; availableOriginal: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!fundingId) { setAvailable(null); return }
    getFundingAvailable(fundingId).then((a) => setAvailable({ availableUsd: a.availableUsd, availableOriginal: a.availableOriginal })).catch(() => setAvailable(null))
  }, [fundingId])

  const selected = funding.find((f) => f.id === fundingId)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      await createFundTransfer({
        fundingId,
        type,
        amount: Number(amount),
        currencyCode: selected.currencyCode,
        refundTo,
        notes,
      }, userId)
      toast.success(t("Transfer recorded"))
      setAmount(""); setNotes(""); setRefundTo("")
      onSaved()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Failed to record the transfer"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowRightLeft size={16} /> {t("Move or refund leftover funding")}</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <select value={fundingId} onChange={(e) => setFundingId(e.target.value)} required
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="">{t("Select funding source")}</option>
              {funding.map((f) => <option key={f.id} value={f.id}>{f.name} {t("—")} {formatMoney(f.amount, f.currencyCode)}</option>)}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value as "to_general" | "refund")}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm">
              <option value="to_general">{t("Transfer to general pool")}</option>
              <option value="refund">{t("Refund to funder")}</option>
            </select>
            <Input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("Amount")} required />
          </div>
          {selected && available && (
            <p className="text-xs text-muted-foreground">
              {t("Available:")} {formatMoney(available.availableOriginal, selected.currencyCode)} ({formatMoney(available.availableUsd, "USD")}{t("). Partial transfers are allowed.")}
            </p>
          )}
          {type === "refund" && (
            <Input value={refundTo} onChange={(e) => setRefundTo(e.target.value)} placeholder={t("Refund recipient / reference")} />
          )}
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("Notes")} />
          <div className="flex justify-end">
            <Button type="submit" disabled={saving || !selected}>{saving ? t("Saving...") : t("Record transfer")}</Button>
          </div>
        </form>
        {currencies.length === 0 && <p className="text-xs text-muted-foreground mt-2">{t("Add a currency first.")}</p>}
      </CardContent>
    </Card>
  )
}
