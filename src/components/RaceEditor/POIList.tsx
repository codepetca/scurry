"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { POIListItem, type EditorPOI } from "./POIListItem";

interface POIListProps {
  pois: EditorPOI[];
  onReorder: (pois: EditorPOI[]) => void;
  onClueChange: (id: string, clue: string) => void;
  onDelete: (id: string) => void;
  errors?: Record<string, string>;
}

export function POIList({
  pois,
  onReorder,
  onClueChange,
  onDelete,
  errors = {},
}: POIListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pois.findIndex((p) => p.id === active.id);
      const newIndex = pois.findIndex((p) => p.id === over.id);

      const reordered = [...pois];
      const [removed] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, removed);

      onReorder(reordered);
    }
  };

  if (pois.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No locations added yet.</p>
        <p className="text-sm mt-1">Search for locations above to add them.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={pois} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {pois.map((poi, index) => (
            <POIListItem
              key={poi.id}
              poi={poi}
              index={index}
              onClueChange={onClueChange}
              onDelete={onDelete}
              error={errors[poi.id]}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
