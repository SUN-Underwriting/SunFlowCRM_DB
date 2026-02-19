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
      <DialogContent className='sm:max-w-[820px]'>
        <DialogHeader>
          <DialogTitle>Create New Lead</DialogTitle>
          <DialogDescription>
            Add a new lead and capture the key context up front.
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[75vh] overflow-auto pr-1'>
          <LeadForm
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isLoading={createLead.isPending}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
