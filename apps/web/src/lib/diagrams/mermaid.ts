/**
 * Removes common model-output wrappers and makes square-bracket flowchart labels
 * safe for Mermaid's grammar. Citation labels such as `A[Architecture [Source 2]]`
 * otherwise close the node at the citation's first `]` and break the whole diagram.
 */
export function prepareMermaidDefinition(definition: string): string {
  let code = definition.trim()
  const fenced = code.match(/^```(?:mermaid)?\s*\r?\n([\s\S]*?)\r?\n```$/i)
  if (fenced) code = fenced[1]

  return code.split(/\r?\n/).map(quoteSquareBracketLabels).join('\n')
}

function quoteSquareBracketLabels(line: string): string {
  let output = ''
  let index = 0

  while (index < line.length) {
    const nodeStart = line.slice(index).match(/^([A-Za-z_][\w-]*)\[(?!\[)/)
    if (!nodeStart) {
      output += line[index]
      index += 1
      continue
    }

    const labelStart = index + nodeStart[0].length
    let depth = 1
    let cursor = labelStart
    while (cursor < line.length && depth > 0) {
      if (line[cursor] === '[') depth += 1
      if (line[cursor] === ']') depth -= 1
      cursor += 1
    }

    if (depth !== 0) {
      output += line.slice(index)
      break
    }

    const label = line.slice(labelStart, cursor - 1)
    const alreadyQuoted = label.startsWith('"') && label.endsWith('"')
    const labelText = alreadyQuoted ? label.slice(1, -1) : label
    if (alreadyQuoted && !/["\[\]]/.test(labelText)) {
      output += `${nodeStart[1]}[${label}]`
      index = cursor
      continue
    }
    const safeLabel = labelText
      .replace(/&/g, '#38;')
      .replace(/"/g, '#quot;')
      .replace(/\[/g, '#91;')
      .replace(/\]/g, '#93;')
      .replace(/\r?\n/g, '<br/>')

    output += `${nodeStart[1]}["${safeLabel}"]`
    index = cursor
  }

  return output
}
