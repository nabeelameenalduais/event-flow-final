import { runtimeFormatDate as formatDate } from "../i18n/runtimeLocale"
import { useLanguage } from "../contexts/LanguageContext"
import { useState, useEffect, useCallback, useRef } from "react"
import { Upload, Trash2, Download, FileText, Image } from "lucide-react"
import { toast } from "sonner"
import { Button } from "../components/ui/button"
import { Input } from "../components/ui/input"
import { Card, CardContent } from "../components/ui/card"
import { Badge } from "../components/ui/badge"
import { Loading } from "../components/ui/Loading"
import { EmptyState } from "../components/ui/EmptyState"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../components/ui/dialog"
import { useAuth } from "../contexts/AuthContext"
import { getFiles, uploadFile, deleteFile, formatSize, isImage } from "../services/fileService"
import { getProfilesByIds } from "../services/userService"
import type { FileItem } from "../types"

export function FileManagement() {
  const { t, localizeError } = useLanguage()
  
  const { profile } = useAuth()
  const [fileList, setFileList] = useState<FileItem[]>([])
  const [profileMap, setProfileMap] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<FileItem | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFiles()
      setFileList(data)
      const uploaderIds = [...new Set(data.map((f) => f.uploadedBy))]
      if (uploaderIds.length > 0) {
        const profs = await getProfilesByIds(uploaderIds)
        setProfileMap(new Map(profs.map((p: any) => [p.id, p])))
      }
    } catch (e: any) {
      toast.error(localizeError(e?.message ?? t("Failed to load")))
    } finally {
      setLoading(false)
    }
  }, [localizeError, t])

  useEffect(() => { fetch() }, [fetch])

  const handleUpload = async () => {
    if (!selectedFile || !profile) return
    setUploading(true)
    try {
      await uploadFile(selectedFile.name, selectedFile.type, selectedFile.size, profile.id, selectedFile)
      toast.success(t('"{name}" uploaded', { name: selectedFile.name }))
      setUploadOpen(false)
      setSelectedFile(null)
      if (fileRef.current) fileRef.current.value = ""
      fetch()
    } catch (e: any) {
      toast.error(localizeError(e?.message ?? t("Failed to upload file")))
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file: FileItem) => {
    if (!window.confirm(t('Delete file "{name}"?', { name: file.name }))) return
    try {
      await deleteFile(file.id)
      toast.success(t('"{name}" deleted', { name: file.name }))
      fetch()
    } catch (e: any) {
      toast.error(localizeError(e?.message ?? t("Failed to delete file")))
    }
  }

  const handleDownload = (file: FileItem) => {
    const a = document.createElement("a")
    a.href = file.url || "#"
    a.download = file.name
    a.click()
    toast.success(t("Downloading {name}", { name: file.name }))
  }

  if (loading) return <Loading text={t("Loading files...")} />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("File Manager")}</h1>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Upload size={16} /> {t("Upload File")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("Upload File")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input ref={fileRef} type="file" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              {selectedFile && (
                <div className="text-sm text-muted-foreground">
                  <p>{selectedFile.name} ({formatSize(selectedFile.size)})</p>
                </div>
              )}
              <Button className="w-full" disabled={!selectedFile || uploading} onClick={handleUpload}>
                {uploading ? t("Uploading...") : t("Upload")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {fileList.length === 0 ? (
        <EmptyState title={t("No files")} description={t("Upload your first file.")} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fileList.map((file) => {
  
            const uploader = profileMap.get(file.uploadedBy)
            return (
              <Card key={file.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  {isImage(file.type) ? (
                    <div className="w-full h-32 rounded-lg overflow-hidden mb-3 bg-muted flex items-center justify-center cursor-pointer" onClick={() => setPreview(file)}>
                      <Image size={32} className="text-muted-foreground absolute" />
                      {file.url && (
                        <img
                          src={file.url}
                          alt={file.name}
                          className="w-full h-full object-cover relative"
                          onError={(e) => { e.currentTarget.style.display = "none" }}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-32 rounded-lg mb-3 bg-muted flex items-center justify-center">
                      <FileText size={36} className="text-muted-foreground" />
                    </div>
                  )}
                  <p className="font-medium text-sm truncate" title={file.name}>{file.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatSize(file.size)}</span>
                    <Badge variant="outline" className="text-[10px] px-1">{file.type.split("/")[1]}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{uploader?.firstName} {uploader?.lastName} · {formatDate(file.createdAt)}</p>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button size="sm" variant="ghost" className="gap-1" onClick={() => handleDownload(file)}>
                      <Download size={14} /> {t("Download")}
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1 text-destructive ml-auto" onClick={() => handleDelete(file)}>
                      <Trash2 size={14} /> {t("Delete")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="flex items-center justify-center p-4 bg-muted rounded-lg relative">
              <Image size={64} className="text-muted-foreground absolute" />
              {preview.url && (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-h-[60vh] max-w-full object-contain rounded relative"
                  onError={(e) => { e.currentTarget.style.display = "none" }}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
