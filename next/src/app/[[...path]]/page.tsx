import { AppShell } from '@/components/AppShell'

export function generateStaticParams() {
  return [{ path: [] }]
}

export default function CatchAllPage() {
  return <AppShell />
}
