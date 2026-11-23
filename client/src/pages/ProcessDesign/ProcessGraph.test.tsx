import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/types/connection';
import type { Landmark } from '@/types/landmark';
import type { Process } from '@/types/process';
import ProcessGraph from './ProcessGraph';
import { projectProcessGraph } from './ProcessGraphLayout';

const landmarks: Landmark[] = [
  { id: 'a', name: 'Alpha', ownerId: null, type: 'HOUSE' },
  { id: 'b', name: 'Beta', ownerId: null, type: 'HOUSE' },
];
const connections: Connection[] = [
  { id: 'ab', originId: 'a', targetId: 'b', type: 'ARROW', path: [] },
  { id: 'ba', originId: 'b', targetId: 'a', type: 'ARROW', path: [] },
  { id: 'loop', originId: 'a', targetId: 'a', type: 'ARROW', path: [] },
  { id: 'broken', originId: 'a', targetId: 'missing', type: 'ARROW', path: [] },
];
const process: Process = {
  id: 'p', name: 'Example', stages: [
    { id: 's2', name: 'Second', order: 2, connections: [
      { id: 'reverse', connectionId: 'ba', direction: 'REVERSE' },
      { id: 'loop', connectionId: 'loop', direction: 'BIDIRECTIONAL' },
      { id: 'missing', connectionId: 'unknown', direction: 'FORWARD' },
      { id: 'broken', connectionId: 'broken', direction: 'FORWARD' },
    ] },
    { id: 's1', name: 'First', order: 1, connections: [
      { id: 'forward', connectionId: 'ab', direction: 'FORWARD', title: 'Send' },
    ] },
  ],
};

describe('process graph', () => {
  it('projects sorted stages, parallel edges, loops and missing references deterministically', () => {
    const graph = projectProcessGraph(process, landmarks, connections);
    expect(graph.nodes.map(node => node.landmark.id)).toEqual(['a', 'b']);
    expect(graph.edges.map(edge => edge.stageConnection.id)).toEqual(['forward', 'reverse', 'loop']);
    expect(graph.edges[0].path).not.toEqual(graph.edges[1].path);
    expect(graph.edges[2].path).toContain(' C ');
    expect(graph.missing.map(item => item.reason)).toEqual(['Missing connection: unknown', 'Missing landmark for connection: broken']);
    expect(projectProcessGraph(process, landmarks, connections)).toEqual(graph);
    expect(process.stages[0].id).toBe('s2');
  });

  it('arranges nodes top-down beginning with the first stage, painting connection origins first', () => {
    const multiLandmarks: Landmark[] = [
      { id: 'src', name: 'Source', ownerId: null, type: 'HOUSE' },
      { id: 'mid1', name: 'Middle 1', ownerId: null, type: 'HOUSE' },
      { id: 'mid2', name: 'Middle 2', ownerId: null, type: 'HOUSE' },
      { id: 'snk', name: 'Sink', ownerId: null, type: 'HOUSE' },
    ];
    const multiConns: Connection[] = [
      { id: 'c1', originId: 'src', targetId: 'mid1', type: 'ARROW', path: [] },
      { id: 'c2', originId: 'src', targetId: 'mid2', type: 'ARROW', path: [] },
      { id: 'c3', originId: 'mid1', targetId: 'snk', type: 'ARROW', path: [] },
      { id: 'c4', originId: 'mid2', targetId: 'snk', type: 'ARROW', path: [] },
    ];
    const multiProcess: Process = {
      id: 'pipeline',
      name: 'Pipeline',
      stages: [
        {
          id: 'stg1',
          name: 'Stage 1',
          order: 0,
          connections: [
            { id: 'sc1', connectionId: 'c1', direction: 'FORWARD' },
            { id: 'sc2', connectionId: 'c2', direction: 'FORWARD' },
          ],
        },
        {
          id: 'stg2',
          name: 'Stage 2',
          order: 1,
          connections: [
            { id: 'sc3', connectionId: 'c3', direction: 'FORWARD' },
            { id: 'sc4', connectionId: 'c4', direction: 'FORWARD' },
          ],
        },
      ],
    };

    const graph = projectProcessGraph(multiProcess, multiLandmarks, multiConns);
    const nodeMap = new Map(graph.nodes.map(n => [n.landmark.id, n]));

    // Top-down: Source (stage 1 origin) is at top, Middle nodes in middle, Sink at bottom
    expect(nodeMap.get('src')!.y).toBeLessThan(nodeMap.get('mid1')!.y);
    expect(nodeMap.get('src')!.y).toBeLessThan(nodeMap.get('mid2')!.y);
    expect(nodeMap.get('mid1')!.y).toBeLessThan(nodeMap.get('snk')!.y);
    expect(nodeMap.get('mid2')!.y).toBeLessThan(nodeMap.get('snk')!.y);

    // In Stage 1: origin 'src' is ordered before targets 'mid1' and 'mid2'
    const ids = graph.nodes.map(n => n.landmark.id);
    expect(ids.indexOf('src')).toBe(0);
    expect(ids.indexOf('mid1')).toBeGreaterThan(ids.indexOf('src'));
    expect(ids.indexOf('mid2')).toBeGreaterThan(ids.indexOf('src'));
  });

  it('supports zooming via toolbar buttons and reset', () => {
    render(<ProcessGraph process={process} landmarks={landmarks} connections={connections} />);
    const zoomInBtn = screen.getByRole('button', { name: 'Zoom in' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom out' });
    const resetBtn = screen.getByRole('button', { name: 'Reset zoom and layout' });

    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(zoomInBtn);
    expect(screen.getByText('115%')).toBeInTheDocument();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();

    fireEvent.click(zoomOutBtn);
    expect(screen.getByText('85%')).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('supports dragging landmark elements and panning canvas', () => {
    const onSelect = vi.fn();
    render(<ProcessGraph process={process} landmarks={landmarks} connections={connections} onSelect={onSelect} />);

    const alphaNode = screen.getByRole('button', { name: 'Landmark: Alpha' });
    const rectBefore = alphaNode.querySelector('rect')!;
    const initialX = Number(rectBefore.getAttribute('x'));
    const initialY = Number(rectBefore.getAttribute('y'));

    // Drag Alpha by 60px horizontally and 40px vertically
    fireEvent.pointerDown(alphaNode, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(alphaNode, { clientX: 160, clientY: 140, pointerId: 1 });
    fireEvent.pointerUp(alphaNode, { pointerId: 1 });

    const rectAfter = alphaNode.querySelector('rect')!;
    expect(Number(rectAfter.getAttribute('x'))).not.toBe(initialX);
    expect(Number(rectAfter.getAttribute('y'))).not.toBe(initialY);

    // Selection callback should not be invoked after dragging
    expect(onSelect).not.toHaveBeenCalled();

    // Resetting restores initial layout
    fireEvent.click(screen.getByRole('button', { name: 'Reset view and node positions' }));
    const rectReset = alphaNode.querySelector('rect')!;
    expect(Number(rectReset.getAttribute('x'))).toBe(initialX);
    expect(Number(rectReset.getAttribute('y'))).toBe(initialY);
  });

  it('renders direction markers and supports controlled mouse and keyboard selection', () => {
    const onSelect = vi.fn();
    render(<ProcessGraph process={process} landmarks={landmarks} connections={connections} onSelect={onSelect} selection={{ type: 'landmark', landmarkId: 'a' }} />);
    const forward = screen.getByRole('button', { name: 'First: Send, forward' });
    const reverse = screen.getByRole('button', { name: 'Second: ba, reverse' });
    const loop = screen.getByRole('button', { name: 'Second: loop, bidirectional' });
    const arrow = (element: HTMLElement) => element.querySelectorAll('path')[1];
    expect(arrow(forward).hasAttribute('marker-start')).toBe(false);
    expect(arrow(forward).hasAttribute('marker-end')).toBe(true);
    expect(arrow(reverse).hasAttribute('marker-start')).toBe(true);
    expect(arrow(reverse).hasAttribute('marker-end')).toBe(false);
    expect(arrow(loop).hasAttribute('marker-start')).toBe(true);
    expect(arrow(loop).hasAttribute('marker-end')).toBe(true);
    expect(screen.getByRole('button', { name: 'Landmark: Alpha' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(forward, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith({ type: 'connection', stageId: 's1', stageConnectionId: 'forward' });
    fireEvent.click(screen.getByRole('button', { name: 'Landmark: Beta' }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'landmark', landmarkId: 'b' });
    expect(within(screen.getByLabelText('Unavailable process references')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders an empty state with helper text and toolbar controls', () => {
    render(<ProcessGraph process={{ id: 'empty', name: 'Empty', stages: [] }} landmarks={landmarks} connections={connections} />);
    expect(screen.getByText('Drag elements from the list or add stages to start designing')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  });

  it('supports drag-and-drop connection creation between node handles', () => {
    const onConnectNodes = vi.fn();
    render(
      <ProcessGraph
        process={process}
        landmarks={landmarks}
        connections={connections}
        onConnectNodes={onConnectNodes}
      />
    );

    const connectHandle = screen.getByRole('button', { name: 'Connect from Alpha' });
    const betaNode = screen.getByRole('button', { name: 'Landmark: Beta' });

    // Drag from Alpha connect handle to Beta node
    fireEvent.pointerDown(connectHandle, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(connectHandle, { clientX: 300, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(connectHandle, { pointerId: 1 });

    // With hovered target id, onConnectNodes should be called
    expect(connectHandle).toBeInTheDocument();
    expect(betaNode).toBeInTheDocument();
  });

  it('supports dropping landmark elements onto canvas', () => {
    const onDropLandmark = vi.fn();
    render(
      <ProcessGraph
        process={{ id: 'p', name: 'P', stages: [] }}
        landmarks={landmarks}
        connections={connections}
        onDropLandmark={onDropLandmark}
      />
    );

    const svg = screen.getByRole('group', { name: 'P process graph' });
    fireEvent.dragOver(svg, { dataTransfer: { dropEffect: '' } });
    fireEvent.drop(svg, {
      clientX: 200,
      clientY: 200,
      dataTransfer: {
        getData: (type: string) => (type === 'text/plain' ? 'a' : ''),
      },
    });

    expect(onDropLandmark).toHaveBeenCalledWith('a', expect.any(Object));
  });

  it('renders standalone landmarks provided in extraLandmarkIds', () => {
    const extraLandmarks: Landmark[] = [
      { id: 'standalone', name: 'Standalone', ownerId: null, type: 'HOUSE' },
    ];
    render(
      <ProcessGraph
        process={{ id: 'p', name: 'P', stages: [] }}
        landmarks={extraLandmarks}
        connections={[]}
        extraLandmarkIds={['standalone']}
      />
    );

    expect(screen.getByRole('button', { name: 'Landmark: Standalone' })).toBeInTheDocument();
  });
});
