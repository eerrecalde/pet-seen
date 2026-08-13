type IconProps = { name: string }

export function Icon({ name }: IconProps) {
  return <i className={`ri-${name}-line`} aria-hidden="true" />
}
