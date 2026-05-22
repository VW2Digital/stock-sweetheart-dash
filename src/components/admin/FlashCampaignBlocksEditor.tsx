import { useState } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Trash2, Plus, ChevronDown, ChevronRight,
  Video, ListChecks, Gift, ShieldCheck, MessageSquareQuote, Users, HelpCircle, ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type BlockType =
  | 'video' | 'image' | 'benefits' | 'bonus' | 'guarantee'
  | 'testimonials' | 'social_proof' | 'faq';

export interface CampaignBlock {
  id: string;
  type: BlockType;
  visible?: boolean;
  data: Record<string, any>;
}

const BLOCK_META: Record<BlockType, { label: string; Icon: any; defaults: Record<string, any> }> = {
  video: { label: 'Vídeo (VSL)', Icon: Video, defaults: { url: '', title: 'Assista ao vídeo' } },
  image: { label: 'Imagem', Icon: ImageIcon, defaults: { url: '', alt: '', caption: '' } },
  benefits: {
    label: 'Benefícios', Icon: ListChecks,
    defaults: { title: 'O que você vai receber', items: ['Benefício 1', 'Benefício 2', 'Benefício 3'] },
  },
  bonus: {
    label: 'Bônus', Icon: Gift,
    defaults: { title: 'Bônus exclusivos', items: [{ name: 'Bônus 1', value: 'R$ 197' }] },
  },
  guarantee: {
    label: 'Garantia', Icon: ShieldCheck,
    defaults: { title: 'Garantia de 7 dias', text: 'Se não gostar, devolvemos 100% do seu dinheiro.', days: 7 },
  },
  testimonials: {
    label: 'Depoimentos', Icon: MessageSquareQuote,
    defaults: {
      title: 'O que dizem nossos clientes',
      items: [{ name: 'Maria S.', text: 'Mudou minha vida!', avatar: '', rating: 5 }],
    },
  },
  social_proof: {
    label: 'Prova social', Icon: Users,
    defaults: { title: '+12.000 clientes satisfeitos', subtitle: 'Junte-se a milhares de pessoas' },
  },
  faq: {
    label: 'Perguntas frequentes', Icon: HelpCircle,
    defaults: { title: 'Dúvidas frequentes', items: [{ q: 'Como funciona?', a: 'Após o pagamento você recebe acesso imediato.' }] },
  },
};

const newId = () => crypto.randomUUID();

interface Props {
  blocks: CampaignBlock[];
  onChange: (next: CampaignBlock[]) => void;
}

export function FlashCampaignBlocksEditor({ blocks, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addBlock = (type: BlockType) => {
    onChange([...blocks, { id: newId(), type, visible: true, data: { ...BLOCK_META[type].defaults } }]);
  };

  const updateBlock = (id: string, patch: Partial<CampaignBlock>) => {
    onChange(blocks.map(b => (b.id === id ? { ...b, ...patch, data: { ...b.data, ...(patch.data || {}) } } : b)));
  };

  const removeBlock = (id: string) => onChange(blocks.filter(b => b.id !== id));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BLOCK_META) as BlockType[]).map(t => {
          const M = BLOCK_META[t];
          return (
            <Button key={t} type="button" size="sm" variant="outline" onClick={() => addBlock(t)}>
              <M.Icon className="w-3.5 h-3.5 mr-1.5" /> <Plus className="w-3 h-3 mr-1" />{M.label}
            </Button>
          );
        })}
      </div>

      {blocks.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum bloco. Adicione blocos acima para construir sua página de oferta.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((b) => (
              <SortableBlock key={b.id} block={b} onUpdate={updateBlock} onRemove={removeBlock} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SortableBlock({ block, onUpdate, onRemove }: {
  block: CampaignBlock;
  onUpdate: (id: string, patch: Partial<CampaignBlock>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const [open, setOpen] = useState(false);
  const Meta = BLOCK_META[block.type];
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="rounded-md border border-border bg-muted/30">
      <div className="flex items-center gap-2 p-3">
        <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 text-left">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Meta.Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{Meta.label}</span>
          {block.data.title && <span className="text-xs text-muted-foreground truncate">— {block.data.title}</span>}
        </button>
        <div className="flex items-center gap-2">
          <Switch checked={block.visible !== false} onCheckedChange={(v) => onUpdate(block.id, { visible: v })} />
          <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(block.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border p-4 bg-background">
          <BlockEditor block={block} onUpdate={(data) => onUpdate(block.id, { data })} />
        </div>
      )}
    </div>
  );
}

function BlockEditor({ block, onUpdate }: { block: CampaignBlock; onUpdate: (data: Record<string, any>) => void }) {
  const d = block.data;
  const patch = (p: Record<string, any>) => onUpdate({ ...d, ...p });

  switch (block.type) {
    case 'video':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título (opcional)</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <div>
            <Label>URL do vídeo (YouTube, Vimeo ou MP4)</Label>
            <Input value={d.url || ''} onChange={e => patch({ url: e.target.value })}
                   placeholder="https://youtube.com/watch?v=..." />
            <p className="text-xs text-muted-foreground mt-1">Aceita links do YouTube, Vimeo ou arquivo .mp4 direto.</p>
          </div>
        </div>
      );
    case 'image':
      return (
        <div className="grid gap-3">
          <div>
            <Label>URL da imagem</Label>
            <Input value={d.url || ''} onChange={e => patch({ url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label>Texto alternativo</Label>
            <Input value={d.alt || ''} onChange={e => patch({ alt: e.target.value })} />
          </div>
          <div>
            <Label>Legenda (opcional)</Label>
            <Input value={d.caption || ''} onChange={e => patch({ caption: e.target.value })} />
          </div>
        </div>
      );
    case 'benefits':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <ListEditor
            label="Itens"
            items={(d.items || []) as string[]}
            onChange={(items) => patch({ items })}
            renderItem={(item, set) => (
              <Input value={item} onChange={e => set(e.target.value)} placeholder="Benefício" />
            )}
            empty=""
          />
        </div>
      );
    case 'bonus':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <ListEditor
            label="Bônus"
            items={(d.items || []) as { name: string; value: string }[]}
            onChange={(items) => patch({ items })}
            renderItem={(item, set) => (
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={item.name} onChange={e => set({ ...item, name: e.target.value })} placeholder="Nome do bônus" />
                <Input value={item.value} onChange={e => set({ ...item, value: e.target.value })} placeholder="Ex: R$ 197" />
              </div>
            )}
            empty={{ name: '', value: '' }}
          />
        </div>
      );
    case 'guarantee':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <div>
            <Label>Dias de garantia</Label>
            <Input type="number" min="0" value={d.days || 7} onChange={e => patch({ days: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Texto</Label>
            <Textarea rows={3} value={d.text || ''} onChange={e => patch({ text: e.target.value })} />
          </div>
        </div>
      );
    case 'testimonials':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <ListEditor
            label="Depoimentos"
            items={(d.items || []) as { name: string; text: string; avatar?: string; rating?: number }[]}
            onChange={(items) => patch({ items })}
            renderItem={(item, set) => (
              <div className="grid gap-2">
                <div className="grid gap-2 md:grid-cols-3">
                  <Input value={item.name} onChange={e => set({ ...item, name: e.target.value })} placeholder="Nome" />
                  <Input value={item.avatar || ''} onChange={e => set({ ...item, avatar: e.target.value })} placeholder="URL foto (opcional)" />
                  <Select value={String(item.rating || 5)} onValueChange={(v) => set({ ...item, rating: Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 4, 3, 2, 1].map(n => <SelectItem key={n} value={String(n)}>{n} estrelas</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea rows={2} value={item.text} onChange={e => set({ ...item, text: e.target.value })} placeholder="Depoimento" />
              </div>
            )}
            empty={{ name: '', text: '', avatar: '', rating: 5 }}
          />
        </div>
      );
    case 'social_proof':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título (ex: número de clientes)</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <div>
            <Label>Subtítulo</Label>
            <Input value={d.subtitle || ''} onChange={e => patch({ subtitle: e.target.value })} />
          </div>
        </div>
      );
    case 'faq':
      return (
        <div className="grid gap-3">
          <div>
            <Label>Título</Label>
            <Input value={d.title || ''} onChange={e => patch({ title: e.target.value })} />
          </div>
          <ListEditor
            label="Perguntas"
            items={(d.items || []) as { q: string; a: string }[]}
            onChange={(items) => patch({ items })}
            renderItem={(item, set) => (
              <div className="grid gap-2">
                <Input value={item.q} onChange={e => set({ ...item, q: e.target.value })} placeholder="Pergunta" />
                <Textarea rows={2} value={item.a} onChange={e => set({ ...item, a: e.target.value })} placeholder="Resposta" />
              </div>
            )}
            empty={{ q: '', a: '' }}
          />
        </div>
      );
  }
}

function ListEditor<T>({ label, items, onChange, renderItem, empty }: {
  label: string;
  items: T[];
  onChange: (items: T[]) => void;
  renderItem: (item: T, set: (next: T) => void) => React.ReactNode;
  empty: T;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, structuredClone(empty)])}>
          <Plus className="w-3 h-3 mr-1" />Adicionar
        </Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="rounded border border-border bg-muted/30 p-2 flex items-start gap-2">
          <div className="flex-1">
            {renderItem(it, (next) => {
              const arr = [...items]; arr[i] = next; onChange(arr);
            })}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
