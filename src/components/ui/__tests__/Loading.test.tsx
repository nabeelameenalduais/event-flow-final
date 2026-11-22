import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { Loading } from "../Loading"

describe("Loading", () => {
  it("renders without text", () => {
    const { container } = render(<Loading />)
    expect(container.querySelector(".animate-spin")).toBeInTheDocument()
  })

  it("renders with text", () => {
    render(<Loading text="Loading..." />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("applies size classes", () => {
    const { container } = render(<Loading size="sm" />)
    const spinner = container.querySelector(".animate-spin")
    expect(spinner?.className).toContain("h-4")
  })
})
