'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { IconSearch, IconUser } from '@tabler/icons-react';
import { personsApi } from '@/lib/api/crm-client';
import { useUpdatePerson } from '../hooks/use-persons';
import { useDebounce } from '@/hooks/use-debounce';
import type { PersonWithRelations } from '@/lib/api/crm-types';

interface LinkExistingContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function LinkExistingContactDialog({
  open,
  onOpenChange,
  organizationId
}: LinkExistingContactDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [persons, setPersons] = useState<PersonWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const updatePerson = useUpdatePerson();

  useEffect(() => {
    if (open) {
      loadPersons();
    }
  }, [open, debouncedSearch]);

  const loadPersons = async () => {
    try {
      setLoading(true);
      const response = await personsApi.list({
        search: debouncedSearch,
        take: 50
      });
      // Filter out persons already linked to this organization
      const filtered = response.data.persons?.filter(
        (p) => p.orgId !== organizationId
      ) || [];
      setPersons(filtered);
    } catch (error) {
      console.error('Failed to load persons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPerson = async (personId: string) => {
    try {
      await updatePerson.mutateAsync({
        id: personId,
        data: { organizationId: organizationId }
      });
      onOpenChange(false);
      setSearchQuery('');
    } catch (error) {
      // Error handled by mutation hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>Link Existing Contact</DialogTitle>
          <DialogDescription>
            Select a contact to link to this organization.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='relative'>
            <IconSearch className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
            <Input
              placeholder='Search contacts by name or email...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='pl-9'
            />
          </div>

          <div className='max-h-[400px] overflow-y-auto rounded-md border'>
            {loading ? (
              <div className='flex items-center justify-center p-8'>
                <p className='text-muted-foreground text-sm'>Loading...</p>
              </div>
            ) : persons.length === 0 ? (
              <div className='flex items-center justify-center p-8'>
                <p className='text-muted-foreground text-sm'>
                  {debouncedSearch
                    ? 'No contacts found matching your search.'
                    : 'No available contacts to link.'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Job Title</TableHead>
                    <TableHead className='w-[100px]'>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {persons.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className='font-medium'>
                        <div className='flex items-center gap-2'>
                          <IconUser className='h-4 w-4 text-muted-foreground' />
                          {person.firstName} {person.lastName}
                        </div>
                      </TableCell>
                      <TableCell>{person.email || '—'}</TableCell>
                      <TableCell>{person.jobTitle || '—'}</TableCell>
                      <TableCell>
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => handleLinkPerson(person.id)}
                          disabled={updatePerson.isPending}
                        >
                          Link
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
