'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { LeadForm, LeadFormValues } from './lead-form';
import { useCreateLead } from '../hooks/use-leads';

interface CreateLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Create Lead Dialog
 * Best Practice (Context7): Use mutation hooks for data updates
 */
export function CreateLeadDialog({
  open,
  onOpenChange
}: CreateLeadDialogProps) {
  const createLead = useCreateLead();

  const handleSubmit = async (values: LeadFormValues) => {
    await createLead.mutateAsync(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
          <DialogDescription>
            Add a new lead to your pipeline. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        <LeadForm
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={createLead.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}
