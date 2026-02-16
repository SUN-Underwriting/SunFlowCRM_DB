'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fieldDefinitionsApi } from '@/lib/api/crm-client';
import { toast } from 'sonner';
import type {
  FieldDefinition,
  FieldEntityType,
  FieldType
} from '@prisma/client';

interface CustomFieldsManagerProps {
  onEdit?: (field: FieldDefinition) => void;
  onCreate?: (entityType: FieldEntityType) => void;
}

const fieldTypeLabels: Record<FieldType, string> = {
  TEXT: 'Text',
  NUMBER: 'Number',
  DATE: 'Date',
  SELECT: 'Select',
  MULTI_SELECT: 'Multi Select'
};

/**
 * Custom Fields Manager Component
 * Best Practice: Manage custom field definitions by entity type
 */
export function CustomFieldsManager({
  onEdit,
  onCreate
}: CustomFieldsManagerProps) {
  const [selectedEntityType, setSelectedEntityType] =
    useState<FieldEntityType>('DEAL');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['field-definitions', selectedEntityType],
    queryFn: async () => {
      const response = await fieldDefinitionsApi.list({
        entityType: selectedEntityType
      });
      return response.data.fieldDefinitions || [];
    }
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      await fieldDefinitionsApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['field-definitions', selectedEntityType]
      });
      toast.success('Custom field deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete custom field');
    }
  });

  const fields = data || [];

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Custom Fields</CardTitle>
            <CardDescription>
              Define custom fields for deals, persons, and organizations
            </CardDescription>
          </div>
          <div className='flex items-center gap-3'>
            <Select
              value={selectedEntityType}
              onValueChange={(value) =>
                setSelectedEntityType(value as FieldEntityType)
              }
            >
              <SelectTrigger className='w-[200px]'>
                <SelectValue placeholder='Select entity' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='DEAL'>Deals</SelectItem>
                <SelectItem value='PERSON'>Persons</SelectItem>
                <SelectItem value='ORGANIZATION'>Organizations</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => onCreate?.(selectedEntityType)}>
              <IconPlus className='mr-2 h-4 w-4' />
              Add Field
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='space-y-2'>
            {[...Array(3)].map((_, i) => (
              <div key={i} className='bg-muted h-12 animate-pulse rounded' />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <div className='text-muted-foreground py-12 text-center'>
            <p>
              No custom fields defined for {selectedEntityType.toLowerCase()}s
            </p>
            <p className='mt-2 text-sm'>
              Create custom fields to extend your CRM data
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Options</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field) => (
                <TableRow key={field.id}>
                  <TableCell className='font-medium'>{field.label}</TableCell>
                  <TableCell>
                    <code className='bg-muted rounded px-1.5 py-0.5 text-xs'>
                      {field.key}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant='outline'>
                      {fieldTypeLabels[field.fieldType as FieldType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {(field.fieldType === 'SELECT' ||
                      field.fieldType === 'MULTI_SELECT') &&
                    Array.isArray(field.options) ? (
                      <div className='text-muted-foreground text-xs'>
                        {field.options.length} options
                      </div>
                    ) : (
                      <span className='text-muted-foreground'>—</span>
                    )}
                  </TableCell>
                  <TableCell className='text-right'>
                    <div className='flex items-center justify-end gap-2'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => onEdit?.(field)}
                      >
                        <IconEdit className='h-4 w-4' />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            disabled={deleteField.isPending}
                          >
                            <IconTrash className='h-4 w-4' />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete Custom Field
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;
                              {field.label}&quot;? Existing data using this
                              field will not be removed but will no longer be
                              visible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteField.mutate(field.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
