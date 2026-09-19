'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  PlusCircle,
  History,
  Settings,
  TrendingUp,
  Download,
  Upload,
  DollarSign
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { exportData, downloadJSON, importData } from '@/lib/storage'
import { toast } from 'sonner'

const mainNavItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Novo Trade',
    url: '/trades/new',
    icon: PlusCircle,
  },
  {
    title: 'Withdraw',
    url: '/withdraw',
    icon: DollarSign,
  },
  {
    title: 'Historico de Trades',
    url: '/history',
    icon: History,
  },
  {
    title: 'Configuracoes',
    url: '/settings',
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  const handleExport = () => {
    try {
      const data = exportData()

      if (!data) {
        throw new Error('Dados vazios para exportação')
      }

      const date = new Date().toISOString().split('T')[0]

      downloadJSON(`crypto-trades-${date}.json`, data)

      toast.success('Dados exportados com sucesso!')
    } catch (error) {
      console.error('Erro ao exportar:', error)
      toast.error('Erro ao exportar dados')
    }
  }
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        importData(text)
        toast.success('Dados importados com sucesso! Recarregando...')
        setTimeout(() => window.location.reload(), 1000)
      } catch {
        toast.error('Erro ao importar dados. Verifique o arquivo.')
      }
    }
    input.click()
  }

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="size-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Target Hunter</span>
            <span className="text-xs text-muted-foreground">Manager</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <Link href={item.url}>
                      <item.icon className="size-10" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarSeparator className="mb-2 hidden" />
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleExport}
          >
            <Download className="mr-2 size-4" />
            Exportar JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={handleImport}
          >
            <Upload className="mr-2 size-4" />
            Importar JSON
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
