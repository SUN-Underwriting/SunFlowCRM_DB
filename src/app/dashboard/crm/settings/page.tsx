'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PipelinesList } from '@/features/crm/settings/components/pipelines-list';
import { PipelineFormDialog } from '@/features/crm/settings/components/pipeline-form-dialog';
import { StagesManager } from '@/features/crm/settings/components/stages-manager';
import { StageFormDialog } from '@/features/crm/settings/components/stage-form-dialog';
import { CustomFieldsManager } from '@/features/crm/settings/components/custom-fields-manager';
import { CustomFieldFormDialog } from '@/features/crm/settings/components/custom-field-form-dialog';
import type {
  PipelineWithRelations,
  StageWithRelations
} from '@/lib/api/crm-types';
import type { FieldDefinition, FieldEntityType } from '@prisma/client';

/**
 * CRM Settings Page
 * Best Practice: Tabbed interface for different settings sections
 */
export default function CRMSettingsPage() {
  const [activeTab, setActiveTab] = useState('pipelines');

  // Pipeline dialogs
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<
    PipelineWithRelations | undefined
  >();

  // Stage dialogs
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<
    StageWithRelations | undefined
  >();
  const [selectedPipelineForStage, setSelectedPipelineForStage] =
    useState<string>('');

  // Custom field dialogs
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<
    FieldDefinition | undefined
  >();
  const [selectedEntityType, setSelectedEntityType] =
    useState<FieldEntityType>('DEAL');

  const handleEditPipeline = (pipeline: PipelineWithRelations) => {
    setEditingPipeline(pipeline);
    setPipelineDialogOpen(true);
  };

  const handleCreatePipeline = () => {
    setEditingPipeline(undefined);
    setPipelineDialogOpen(true);
  };

  const handleEditStage = (stage: StageWithRelations) => {
    setEditingStage(stage);
    setSelectedPipelineForStage(stage.pipelineId);
    setStageDialogOpen(true);
  };

  const handleCreateStage = (pipelineId: string) => {
    setEditingStage(undefined);
    setSelectedPipelineForStage(pipelineId);
    setStageDialogOpen(true);
  };

  const handleEditField = (field: FieldDefinition) => {
    setEditingField(field);
    setSelectedEntityType(field.entityType);
    setFieldDialogOpen(true);
  };

  const handleCreateField = (entityType: FieldEntityType) => {
    setEditingField(undefined);
    setSelectedEntityType(entityType);
    setFieldDialogOpen(true);
  };

  return (
    <div className='flex-1 space-y-4 p-4 pt-6 md:p-8'>
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-3xl font-bold tracking-tight'>CRM Settings</h2>
          <p className='text-muted-foreground'>
            Configure pipelines, stages, and custom fields
          </p>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className='space-y-4'
      >
        <TabsList>
          <TabsTrigger value='pipelines'>Pipelines</TabsTrigger>
          <TabsTrigger value='stages'>Stages</TabsTrigger>
          <TabsTrigger value='custom-fields'>Custom Fields</TabsTrigger>
        </TabsList>

        <TabsContent value='pipelines' className='space-y-4'>
          <PipelinesList
            onEdit={handleEditPipeline}
            onCreate={handleCreatePipeline}
          />
        </TabsContent>

        <TabsContent value='stages' className='space-y-4'>
          <StagesManager
            onEditStage={handleEditStage}
            onCreateStage={handleCreateStage}
          />
        </TabsContent>

        <TabsContent value='custom-fields' className='space-y-4'>
          <CustomFieldsManager
            onEdit={handleEditField}
            onCreate={handleCreateField}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PipelineFormDialog
        open={pipelineDialogOpen}
        onOpenChange={(open) => {
          setPipelineDialogOpen(open);
          if (!open) setEditingPipeline(undefined);
        }}
        pipeline={editingPipeline}
      />

      <StageFormDialog
        open={stageDialogOpen}
        onOpenChange={(open) => {
          setStageDialogOpen(open);
          if (!open) {
            setEditingStage(undefined);
            setSelectedPipelineForStage('');
          }
        }}
        pipelineId={selectedPipelineForStage}
        stage={editingStage}
      />

      <CustomFieldFormDialog
        open={fieldDialogOpen}
        onOpenChange={(open) => {
          setFieldDialogOpen(open);
          if (!open) setEditingField(undefined);
        }}
        entityType={selectedEntityType}
        field={editingField}
      />
    </div>
  );
}
