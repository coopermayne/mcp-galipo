import { Routes, Route } from "react-router"
import { TemplatesHub } from "@/pages/templates/components/templates-hub"
import { PleadingsPage } from "@/pages/templates/components/pleadings-page"
import { RFPPage } from "@/pages/templates/components/rfp-page"
import { ObjectionsPage } from "@/pages/templates/components/objections-page"

export default function TemplatesPage() {
  return (
    <Routes>
      <Route index element={<TemplatesHub />} />
      <Route path="pleadings" element={<PleadingsPage />} />
      <Route path="rfp" element={<RFPPage />} />
      <Route path="rfp/objections" element={<ObjectionsPage />} />
    </Routes>
  )
}
