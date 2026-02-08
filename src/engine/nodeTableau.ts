import type { Card, TableauNode, NodeEdgePattern } from './types';
import { createDeck, shuffleDeck } from './deck';

/**
 * Generates a node-edge tableau from a pattern template
 *
 * @param pattern - The pattern template defining node layout and blocking
 * @param seed - Seed for deterministic random card distribution
 * @returns Array of tableau nodes with cards dealt and reveal states computed
 */
export function generateNodeTableau(
  pattern: NodeEdgePattern,
  seed: string
): TableauNode[] {
  const deck = shuffleDeck(createDeck(), seed);

  let cardIndex = 0;
  const nodes: TableauNode[] = pattern.nodes.map(nodeDef => {
    // Assign cards to this node from deck
    const nodeCards = deck.slice(cardIndex, cardIndex + nodeDef.cardCount);
    cardIndex += nodeDef.cardCount;

    return {
      id: nodeDef.id,
      position: nodeDef.position,
      cards: nodeCards,
      blockedBy: nodeDef.blockedBy,
      revealed: false, // Will be computed after all nodes created
    };
  });

  // Compute initial revealed states
  return computeRevealedStates(nodes);
}

/**
 * Recomputes which nodes are revealed (playable)
 *
 * A node is revealed if:
 * 1. It has at least one card, AND
 * 2. None of its blocking nodes have cards
 *
 * @param nodes - Current node tableau state
 * @returns Updated nodes with correct revealed states
 */
function computeRevealedStates(nodes: TableauNode[]): TableauNode[] {
  return nodes.map(node => {
    if (node.cards.length === 0) {
      return { ...node, revealed: false };
    }

    // Check if any blocking nodes still have cards
    const isBlocked = node.blockedBy.some(blockerId => {
      const blocker = nodes.find(n => n.id === blockerId);
      return blocker && blocker.cards.length > 0;
    });

    return { ...node, revealed: !isBlocked };
  });
}

/**
 * Plays a card from a node (removes top card)
 *
 * @param nodes - Current node tableau state
 * @param nodeId - ID of node to play from
 * @returns Updated nodes and the played card, or null if invalid
 */
export function playCardFromNode(
  nodes: TableauNode[],
  nodeId: string
): { nodes: TableauNode[]; card: Card } | null {
  const node = nodes.find(n => n.id === nodeId);

  // Validate node is playable
  if (!node || node.cards.length === 0 || !node.revealed) {
    return null;
  }

  const playedCard = node.cards[node.cards.length - 1];

  // Remove top card from node
  const updatedNodes = nodes.map(n =>
    n.id === nodeId
      ? { ...n, cards: n.cards.slice(0, -1) }
      : n
  );

  // Recompute revealed states after card removal
  return {
    nodes: computeRevealedStates(updatedNodes),
    card: playedCard,
  };
}

/**
 * Checks if all nodes are cleared (win condition)
 *
 * @param nodes - Current node tableau state
 * @returns True if all nodes are empty
 */
export function checkNodeTableauComplete(nodes: TableauNode[]): boolean {
  return nodes.every(node => node.cards.length === 0);
}

/**
 * Gets list of currently playable nodes
 *
 * @param nodes - Current node tableau state
 * @returns Array of nodes that are revealed and have cards
 */
export function getPlayableNodes(nodes: TableauNode[]): TableauNode[] {
  return nodes.filter(node => node.revealed && node.cards.length > 0);
}
