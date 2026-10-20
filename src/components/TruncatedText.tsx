import { useIsTruncated } from '@/hooks/useIsTruncated'

/** Props textu, který se v úzkém místě zkracuje výpustkou. */
interface TruncatedTextProps {
  /** Zobrazovaný text, např. název feature nebo jméno člena. */
  text: string
  /** Třída s pravidly zkrácení (`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`). */
  className?: string
}

/**
 * Text, který se v úzkém prvku zkrátí výpustkou, a plný text je pak v atributu `title` (tooltip při
 * najetí myší). Nezkrácený text `title` nemá. Zkrácení zjišťuje hook `useIsTruncated`, vzhled
 * (výpustku) řeší CSS třída předaná volajícím.
 *
 * @param props - Text a CSS třída s pravidly zkrácení
 * @returns Prvek `<span>` s textem a případným `title`
 */
export function TruncatedText({ text, className }: TruncatedTextProps) {
  const [ref, truncated] = useIsTruncated<HTMLSpanElement>(text)
  return <span ref={ref} className={className} title={truncated ? text : undefined}>{text}</span>
}
