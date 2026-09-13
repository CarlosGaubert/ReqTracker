import React, { useState, useRef } from 'react';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  Link2, 
  Minus, 
  Eye, 
  Edit3, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  PlusCircle, 
  Sparkles 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  minHeight?: string;
  className?: string;
}

interface GuideItem {
  name: string;
  syntax: string;
  preview: string;
  description: string;
}

const GUIDE_SECTIONS: { category: string; icon: string; items: GuideItem[] }[] = [
  {
    category: 'Formato de Texto',
    icon: '🔤',
    items: [
      { name: 'Negrita', syntax: '**Texto en negrita**', preview: 'Texto en negrita', description: 'Para resaltar conceptos importantes' },
      { name: 'Cursiva', syntax: '*Texto en cursiva*', preview: 'Texto en cursiva', description: 'Para énfasis sutil o términos técnicos' },
      { name: 'Tachado', syntax: '~~Texto tachado~~', preview: 'Texto tachado', description: 'Para indicar descartes o correcciones' },
      { name: 'Código en línea', syntax: '`const variable = 42;`', preview: 'const variable = 42;', description: 'Para comandos, nombres de variables o archivos' },
    ],
  },
  {
    category: 'Estructura y Títulos',
    icon: '📑',
    items: [
      { name: 'Título Principal (H1)', syntax: '# Mi Gran Idea', preview: '# Mi Gran Idea', description: 'Título más grande para la sección principal' },
      { name: 'Subtítulo (H2)', syntax: '## Objetivos del Proyecto', preview: '## Objetivos del Proyecto', description: 'Para secciones secundarias' },
      { name: 'Sección Menor (H3)', syntax: '### Detalles de Implementación', preview: '### Detalles de Implementación', description: 'Para subsecciones o notas específicas' },
      { name: 'Línea Divisoria', syntax: '---', preview: '─────────────', description: 'Separa bloques de contenido visualmente' },
    ],
  },
  {
    category: 'Listas y Checklists',
    icon: '✅',
    items: [
      { name: 'Tarea Pendiente', syntax: '- [ ] Definir alcance inicial', preview: '☐ Definir alcance inicial', description: 'Crea un checkbox desmarcado' },
      { name: 'Tarea Completada', syntax: '- [x] Validación de arquitectura', preview: '☑ Validación de arquitectura', description: 'Crea un checkbox marcado y tachado' },
      { name: 'Lista de Viñetas', syntax: '- Primer punto\n- Segundo punto', preview: '• Primer punto', description: 'Para enumerar sin orden cronológico' },
      { name: 'Lista Numerada', syntax: '1. Investigar\n2. Diseñar\n3. Construir', preview: '1. Investigar', description: 'Para pasos secuenciales o prioridades' },
    ],
  },
  {
    category: 'Citas y Bloques de Código',
    icon: '💬',
    items: [
      { name: 'Cita / Nota Destacada', syntax: '> Esta es una nota relevante que destaca sobre el texto.', preview: '▎ Nota destacada', description: 'Destaca avisos, ideas clave o fuentes' },
      { name: 'Bloque de Código', syntax: '```typescript\nfunction ejecutar() {\n  return true;\n}\n```', preview: 'Bloque multilínea con botón de copiar', description: 'Para fragmentos de código o scripts' },
      { name: 'Enlace Web', syntax: '[Documentación de ReqTracker](https://github.com)', preview: 'Enlace clickeable', description: 'Crea enlaces que abren en el navegador' },
    ],
  },
];

const TEMPLATES = [
  {
    name: '💡 Idea de Proyecto',
    content: `# Nombre de la Idea
> Breve resumen en una oración del valor principal que aporta esta idea.

## Problema
Describe la necesidad o fricción actual que busca resolver.

## Solución Propuesta
- Funcionalidad clave 1
- Funcionalidad clave 2
- Aspecto diferenciador

## Próximos Pasos
- [ ] Validar factibilidad técnica
- [ ] Diseñar flujo de pantallas
- [ ] Definir modelo de datos
`,
  },
  {
    name: '✅ Checklist de Tareas',
    content: `### Objetivos Clave
- [ ] Tarea prioritaria 1
- [ ] Tarea prioritaria 2
- [x] Tarea ya realizada de prueba

> Tip: Usa \`- [ ]\` para tareas pendientes y \`- [x]\` para completadas.
`,
  },
  {
    name: '📝 Notas Rápidas',
    content: `### 📌 Notas y Apuntes
- **Contexto**: Explicación rápida de la situación.
- **Puntos clave**:
  1. Primer punto importante
  2. Segundo punto importante

> Conclusión o decisión acordada.
`,
  },
];

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Escribe tus ideas en formato Markdown...',
  rows = 7,
  minHeight = '180px',
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus helper after insertion
  const insertText = (before: string, after = '', placeholderText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const textToInsert = selectedText || placeholderText;

    const newValue = value.substring(0, start) + before + textToInsert + after + value.substring(end);
    onChange(newValue);

    // Switch to write tab if currently in preview
    if (activeTab === 'preview') {
      setActiveTab('write');
    }

    setTimeout(() => {
      textarea.focus();
      const newCursorStart = start + before.length;
      const newCursorEnd = newCursorStart + textToInsert.length;
      textarea.setSelectionRange(newCursorStart, newCursorEnd);
    }, 10);
  };

  // Line prefix helper (for headers, lists, quotes)
  const applyLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // Find the start of the current line
    const lastNewline = value.lastIndexOf('\n', start - 1);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

    // Check if line already starts with prefix
    const linePrefix = value.substring(lineStart, lineStart + prefix.length);
    if (linePrefix === prefix) {
      // Toggle off
      const newValue = value.substring(0, lineStart) + value.substring(lineStart + prefix.length);
      onChange(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start - prefix.length, end - prefix.length);
      }, 10);
      return;
    }

    const newValue = value.substring(0, lineStart) + prefix + value.substring(lineStart);
    onChange(newValue);

    if (activeTab === 'preview') {
      setActiveTab('write');
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 10);
  };

  // Keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + B for Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      insertText('**', '**', 'texto en negrita');
    }
    // Ctrl/Cmd + I for Italic
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      insertText('*', '*', 'texto en cursiva');
    }
    // Tab key for 2 spaces indentation
    else if (e.key === 'Tab') {
      e.preventDefault();
      insertText('  ', '');
    }
  };

  const handleApplyTemplate = (templateContent: string) => {
    if (value.trim() && !window.confirm('¿Deseas reemplazar el contenido actual con esta plantilla?')) {
      return;
    }
    onChange(templateContent);
    setIsTemplatesOpen(false);
    if (activeTab === 'preview') {
      setActiveTab('write');
    }
  };

  return (
    <div className={`flex flex-col rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 overflow-hidden shadow-sm ${className}`}>
      {/* 1. Header Bar: Tabs (Escribir / Vista Previa) & Learning Tools */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-neutral-100/70 dark:bg-neutral-900/90 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-1 bg-neutral-200/60 dark:bg-neutral-800/80 p-0.5 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'write'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Escribir</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'preview'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-50 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Vista Previa</span>
            {value.trim() && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            )}
          </button>
        </div>

        {/* Learning Guide and Template Buttons */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Plantillas Dropdown Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTemplatesOpen(!isTemplatesOpen);
                if (isGuideOpen) setIsGuideOpen(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer border border-neutral-200/60 dark:border-neutral-700/60"
              title="Insertar plantilla predefinida"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              <span>Plantillas</span>
              {isTemplatesOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {isTemplatesOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg z-30 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider border-b border-neutral-100 dark:border-neutral-800">
                  Plantillas Rápidas
                </div>
                {TEMPLATES.map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl.content)}
                    className="w-full text-left px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800/70 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-semibold">{tmpl.name}</span>
                    <PlusCircle className="h-3.5 w-3.5 text-neutral-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Aprende Markdown Button */}
          <button
            type="button"
            onClick={() => {
              setIsGuideOpen(!isGuideOpen);
              if (isTemplatesOpen) setIsTemplatesOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer border ${
              isGuideOpen
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 border-neutral-200/60 dark:border-neutral-700/60'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Aprende Markdown</span>
            {isGuideOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* 2. Interactive Didactic Guide Panel (Aprende Markdown) */}
      {isGuideOpen && (
        <div className="bg-emerald-500/5 dark:bg-emerald-950/20 border-b border-emerald-500/20 p-3.5 text-xs animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-emerald-500/10">
            <div>
              <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm flex items-center gap-1.5">
                <span>📖 Guía Interactiva de Markdown</span>
              </h4>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Haz clic en <strong>"Insertar"</strong> en cualquier ejemplo para agregarlo directamente a tu nota y aprender experimentando.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsGuideOpen(false)}
              className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1 rounded-md cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
            {GUIDE_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className="bg-white/80 dark:bg-neutral-900/80 rounded-xl p-2.5 border border-neutral-200/80 dark:border-neutral-800 flex flex-col gap-2">
                <div className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5 text-xs">
                  <span>{section.icon}</span>
                  <span>{section.category}</span>
                </div>
                <div className="space-y-1.5">
                  {section.items.map((item, iIdx) => (
                    <div key={iIdx} className="p-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-950/60 border border-neutral-200/40 dark:border-neutral-800/60 flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[11px] text-neutral-700 dark:text-neutral-300">
                          {item.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            insertText(item.syntax + '\n');
                          }}
                          className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded cursor-pointer hover:bg-emerald-500/20"
                          title="Insertar este ejemplo en el editor"
                        >
                          + Insertar
                        </button>
                      </div>
                      <code className="text-[10px] font-mono text-neutral-600 dark:text-neutral-400 bg-neutral-200/50 dark:bg-neutral-800 px-1 py-0.5 rounded truncate">
                        {item.syntax.replace(/\n/g, ' ')}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Formatting Toolbar (visible in write mode) */}
      {activeTab === 'write' && (
        <div className="flex flex-wrap items-center gap-0.5 px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-900/80 border-b border-neutral-200/80 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400">
          {/* Headings */}
          <button
            type="button"
            onClick={() => applyLinePrefix('# ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Título Principal (H1)"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('## ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Subtítulo (H2)"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('### ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Sección Menor (H3)"
          >
            <Heading3 className="h-4 w-4" />
          </button>

          <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1" />

          {/* Text Styling */}
          <button
            type="button"
            onClick={() => insertText('**', '**', 'texto en negrita')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer font-bold"
            title="Negrita (Ctrl+B) - **texto**"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('*', '*', 'texto en cursiva')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer italic"
            title="Cursiva (Ctrl+I) - *texto*"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('~~', '~~', 'texto tachado')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Tachado - ~~texto~~"
          >
            <Strikethrough className="h-4 w-4" />
          </button>

          <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1" />

          {/* Lists and Tasks */}
          <button
            type="button"
            onClick={() => applyLinePrefix('- [ ] ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
            title="Checklist / Tarea pendiente - [ ]"
          >
            <CheckSquare className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('- ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Lista de viñetas - punto"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => applyLinePrefix('1. ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Lista numerada - 1. punto"
          >
            <ListOrdered className="h-4 w-4" />
          </button>

          <span className="w-px h-4 bg-neutral-200 dark:bg-neutral-800 mx-1" />

          {/* Quotes, Code, Links */}
          <button
            type="button"
            onClick={() => applyLinePrefix('> ')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Cita / Nota destacada - > texto"
          >
            <Quote className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('`', '`', 'código')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Código en línea - `código`"
          >
            <Code className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('[', '](https://...)', 'Título del enlace')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Enlace web - [texto](url)"
          >
            <Link2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText('\n---\n')}
            className="p-1.5 rounded-lg hover:bg-neutral-200/60 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
            title="Línea horizontal divisoria ---"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4. Body: Write Mode Textarea or Preview Mode View */}
      {activeTab === 'write' ? (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            style={{ minHeight }}
            className="border-0 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 resize-y p-3.5 text-sm font-mono leading-relaxed text-neutral-900 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          <div className="flex items-center justify-between px-3.5 py-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 bg-neutral-50/50 dark:bg-neutral-950/40 border-t border-neutral-100 dark:border-neutral-800/80 select-none">
            <span className="flex items-center gap-2">
              <span>Soporta Markdown</span>
              <span>•</span>
              <span className="hidden sm:inline">Ctrl+B (negrita), Ctrl+I (cursiva), Tab (sangría)</span>
            </span>
            <span>{value.length} caracteres</span>
          </div>
        </div>
      ) : (
        <div 
          className="p-4 overflow-y-auto bg-neutral-50/40 dark:bg-neutral-950/20"
          style={{ minHeight }}
        >
          {value.trim() ? (
            <MarkdownRenderer content={value} />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-400 dark:text-neutral-500 gap-2">
              <Eye className="h-8 w-8 opacity-40" />
              <p className="text-xs">No hay contenido para previsualizar.</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs h-7 rounded-lg"
                onClick={() => setActiveTab('write')}
              >
                Comenzar a escribir
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
