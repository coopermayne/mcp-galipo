export interface StarConfig {
  value: boolean
  label: string
  iconColor: string
}

export const starConfig: StarConfig[] = [
  { value: true, label: "Starred", iconColor: "text-warning" },
  { value: false, label: "Not Starred", iconColor: "text-muted-foreground" },
]
