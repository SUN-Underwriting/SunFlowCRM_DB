'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  useDealLabels,
  useCreateDealLabel,
  useUpdateDealLabel,
  useDeleteDealLabel
} from '../hooks/use-deal-labels';
import type { DealLabel } from '@prisma/client';

const COLOR_PRESETS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // green
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#6B7280'  // gray
];

/**
 * Deal Labels Manager Component
 * CRUD interface for managing deal labels
 */
export function DealLabelsManager() {
  const { data: labels = [], isLoading } = useDealLabels();
  const createLabel = useCreateDealLabel();
  const updateLabel = useUpdateDealLabel();
  const deleteLabel = useDeleteDealLabel();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<DealLabel | null>(null);
  const [formData, setFormData] = useState({ name: '', color: COLOR_PRESETS[0] });

  const handleOpenDialog = (label?: DealLabel) => {
    if (label) {
      setEditingLabel(label);
      setFormData({ name: label.name, color: label.color || COLOR_PRESETS[0] });
    } else {
      setEditingLabel(null);
      setFormData({ name: '', color: COLOR_PRESETS[0] });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      if (editingLabel) {
        await updateLabel.mutateAsync({
          id: editingLabel.id,
          data: formData
        });
      } else {
        await createLabel.mutateAsync(formData);
      }
      setDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this label?')) return;
    await deleteLabel.mutateAsync(id);
  };

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading labels...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Deal Labels</h3>
          <p className="text-sm text-muted-foreground">
            Manage labels for categorizing deals
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Label
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No labels created yet. Click "Add Label" to create one.
                </TableCell>
              </TableRow>
            ) : (
              labels.map((label) => (
                <TableRow key={label.id}>
                  <TableCell className="font-medium">{label.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-4 w-4 rounded-full border"
                        style={{ backgroundColor: label.color || '#6B7280' }}
                      />
                      <span className="text-sm text-muted-foreground">
                        {label.color || '#6B7280'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-0"
                      style={{
                        backgroundColor: `${label.color || '#6B7280'}15`,
                        color: label.color || '#6B7280'
                      }}
                    >
                      {label.name}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleOpenDialog(label)}
                        disabled={label.isSystem}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(label.id)}
                        disabled={label.isSystem}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingLabel ? 'Edit Label' : 'Create Label'}
              </DialogTitle>
              <DialogDescription>
                {editingLabel
                  ? 'Update the label name and color'
                  : 'Add a new label for categorizing deals'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter label name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="h-8 w-8 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor:
                          formData.color === color ? '#000' : 'transparent'
                      }}
                      onClick={() => setFormData({ ...formData, color })}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preview</Label>
                <Badge
                  variant="outline"
                  className="border-0"
                  style={{
                    backgroundColor: `${formData.color}15`,
                    color: formData.color
                  }}
                >
                  {formData.name || 'Label name'}
                </Badge>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !formData.name.trim() ||
                  createLabel.isPending ||
                  updateLabel.isPending
                }
              >
                {editingLabel ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
