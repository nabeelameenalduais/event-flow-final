import { runtimeLocalizeMessage as localizeToast } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Search, Palette } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { getCategories, createCategory, updateCategory, deleteCategory } from "../services/categoryService"
import type { Category } from "../types"

const COLORS = [
  "#007bff", "#28a745", "#6f42c1", "#fd7e14", "#dc3545",
  "#20c997", "#e83e8c", "#17a2b8", "#ffc107", "#6610f2",
]

function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { t } = useLanguage()
  
  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [color, setColor] = useState(category?.colorCode ?? COLORS[0])
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (category) {
        await updateCategory(category.id, { name, description, colorCode: color })
        toast.success(t("Category updated"))
      } else {
        await createCategory({ name, description, iconUrl: "", colorCode: color })
        toast.success(t("Category created"))
      }
      onClose()
    } catch (err) {
      toast.error(localizeToast(err instanceof Error ? err.message : "Something went wrong"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">{t("Name")}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Conference")} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("Description")}</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Category description")} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t("Color")}</label>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      {color && (
        <div className="flex items-center gap-2 text-sm">
          <Palette size={14} className="text-muted-foreground" />
          <span className="text-muted-foreground">{color}</span>
          <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
        </div>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>{t("Cancel")}</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? t("Saving...") : category ? t("Update") : t("Create")}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function CategoryManagement() {
  const { t } = useLanguage()
  
  const [items, setItems] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Category | undefined>(undefined)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCategories()
      setItems(data)
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to load"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  const filtered = items.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.description.toLowerCase().includes(search.toLowerCase()),
  )

  const handleDelete = async (cat: Category) => {
    if (!window.confirm(t('Delete category "{name}"?', { name: cat.name }))) return
    try {
      await deleteCategory(cat.id)
      toast.success(t('"{name}" deleted', { name: cat.name }))
      fetch()
    } catch (e: any) {
      toast.error(localizeToast(e?.message ?? "Failed to delete category"))
    }
  }

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditing(cat)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("Categories")}</h1>
        <Button onClick={openCreate} className="gap-2"><Plus size={16} /> {t("Add Category")}</Button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("Search categories...")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? <Loading /> : filtered.length === 0 ? (
        <EmptyState title={search ? t("No matches") : t("No categories yet")} description={search ? t("Try a different search") : t("Create your first category.")} />
      ) : (
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Color")}</TableHead>
                <TableHead>{t("Name")}</TableHead>
                <TableHead>{t("Description")}</TableHead>
                <TableHead className="text-right">{t("Actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell>
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: cat.colorCode }} />
                  </TableCell>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground">{cat.description}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(cat)}><Pencil size={14} /></Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(cat)}><Trash2 size={14} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("Edit Category") : t("Create Category")}</DialogTitle>
          </DialogHeader>
          <CategoryForm key={editing?.id ?? "new"} category={editing} onClose={() => { setDialogOpen(false); fetch() }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
