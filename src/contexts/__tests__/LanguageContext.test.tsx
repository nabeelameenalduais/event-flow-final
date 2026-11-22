import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { LanguageProvider, useLanguage } from "../LanguageContext"
import { LANGUAGE_STORAGE_KEY } from "../../i18n"

function TestConsumer() {
  const { language, setLanguage, toggleLanguage, isRtl, t, tp, formatNumber } = useLanguage()
  return (
    <div>
      <span data-testid="language">{language}</span>
      <span data-testid="is-rtl">{String(isRtl)}</span>
      <span data-testid="translated">{t("Events")}</span>
      <span data-testid="plural">{tp("One item", "Many items", 2)}</span>
      <span data-testid="number">{formatNumber(1234)}</span>
      <button onClick={() => setLanguage("en")}>Set English</button>
      <button onClick={() => setLanguage("ar")}>Set Arabic</button>
      <button onClick={toggleLanguage}>Toggle</button>
    </div>
  )
}

describe("LanguageProvider", () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ""
    document.documentElement.dir = ""
  })

  it("defaults to Arabic with RTL direction", async () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>)
    expect(screen.getByTestId("language")).toHaveTextContent("ar")
    expect(screen.getByTestId("is-rtl")).toHaveTextContent("true")
    expect(screen.getByTestId("translated")).toHaveTextContent("الفعاليات")
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("ar")
      expect(document.documentElement.dir).toBe("rtl")
    })
  })

  it("restores a stored language", async () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "en")
    render(<LanguageProvider><TestConsumer /></LanguageProvider>)
    expect(screen.getByTestId("language")).toHaveTextContent("en")
    expect(screen.getByTestId("is-rtl")).toHaveTextContent("false")
    expect(screen.getByTestId("translated")).toHaveTextContent("Events")
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en")
      expect(document.documentElement.dir).toBe("ltr")
    })
  })

  it("ignores invalid stored values and defaults to Arabic", () => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr")
    render(<LanguageProvider><TestConsumer /></LanguageProvider>)
    expect(screen.getByTestId("language")).toHaveTextContent("ar")
  })

  it("switches language instantly and persists", async () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>)
    fireEvent.click(screen.getByText("Set English"))
    expect(screen.getByTestId("language")).toHaveTextContent("en")
    expect(screen.getByTestId("translated")).toHaveTextContent("Events")
    await waitFor(() => {
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en")
      expect(document.documentElement.dir).toBe("ltr")
    })
  })

  it("toggles between languages", async () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>)
    expect(screen.getByTestId("language")).toHaveTextContent("ar")
    fireEvent.click(screen.getByText("Toggle"))
    expect(screen.getByTestId("language")).toHaveTextContent("en")
    fireEvent.click(screen.getByText("Toggle"))
    expect(screen.getByTestId("language")).toHaveTextContent("ar")
  })

  it("provides pluralization and formatting", () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>)
    expect(screen.getByTestId("plural")).toBeInTheDocument()
    expect(screen.getByTestId("number")).toBeInTheDocument()
  })

  it("throws when used outside provider", () => {
    // Suppress expected console error for this negative test.
    const spy = console.error
    console.error = () => {}
    expect(() => render(<TestConsumer />)).toThrow("useLanguage must be used within LanguageProvider")
    console.error = spy
  })
})
