"""Tests for concept graph generation and API endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.concept import ConceptGraph, ConceptNode
from models.subgoal import Subgoal
from models.topic import LearningTopic
from models.user import User


# ── Sample GPT response for "Binary Trees" ──────────────────────────────

BINARY_TREES_GPT_RESPONSE = {
    "parsed": {
        "topic": "Binary Trees",
        "nodes": [
            {
                "key": "binary_trees.definition",
                "name": "Binary Tree Definition",
                "description": "A tree data structure where each node has at most two children, referred to as left and right.",
                "difficulty": "easy",
                "prerequisites": [],
                "sort_order": 0,
            },
            {
                "key": "binary_trees.terminology",
                "name": "Tree Terminology",
                "description": "Key terms: root, leaf, parent, child, depth, height, subtree.",
                "difficulty": "easy",
                "prerequisites": ["binary_trees.definition"],
                "sort_order": 1,
            },
            {
                "key": "binary_trees.types",
                "name": "Types of Binary Trees",
                "description": "Full, complete, perfect, and degenerate binary trees and their properties.",
                "difficulty": "easy",
                "prerequisites": ["binary_trees.definition", "binary_trees.terminology"],
                "sort_order": 2,
            },
            {
                "key": "binary_trees.traversal.inorder",
                "name": "In-Order Traversal",
                "description": "Visit left subtree, root, right subtree (LNR). Produces sorted output for BSTs.",
                "difficulty": "medium",
                "prerequisites": ["binary_trees.definition"],
                "sort_order": 3,
            },
            {
                "key": "binary_trees.traversal.preorder",
                "name": "Pre-Order Traversal",
                "description": "Visit root, left subtree, right subtree (NLR). Used for tree copying.",
                "difficulty": "medium",
                "prerequisites": ["binary_trees.definition"],
                "sort_order": 4,
            },
            {
                "key": "binary_trees.traversal.postorder",
                "name": "Post-Order Traversal",
                "description": "Visit left subtree, right subtree, root (LRN). Used for tree deletion.",
                "difficulty": "medium",
                "prerequisites": ["binary_trees.definition"],
                "sort_order": 5,
            },
            {
                "key": "binary_trees.traversal.bfs",
                "name": "Level-Order Traversal (BFS)",
                "description": "Visit nodes level by level using a queue. Also called breadth-first search.",
                "difficulty": "medium",
                "prerequisites": ["binary_trees.definition", "binary_trees.terminology"],
                "sort_order": 6,
            },
            {
                "key": "binary_trees.bst",
                "name": "Binary Search Tree",
                "description": "A binary tree where left child < parent < right child, enabling O(log n) search.",
                "difficulty": "medium",
                "prerequisites": ["binary_trees.definition", "binary_trees.traversal.inorder"],
                "sort_order": 7,
            },
            {
                "key": "binary_trees.bst.operations",
                "name": "BST Insert and Delete",
                "description": "Algorithms for inserting and removing nodes while maintaining the BST property.",
                "difficulty": "medium",
                "prerequisites": ["binary_trees.bst"],
                "sort_order": 8,
            },
            {
                "key": "binary_trees.balanced",
                "name": "Balanced Binary Trees",
                "description": "Trees where height of left and right subtrees differ by at most 1. AVL trees as example.",
                "difficulty": "hard",
                "prerequisites": ["binary_trees.bst", "binary_trees.types"],
                "sort_order": 9,
            },
            {
                "key": "binary_trees.heap",
                "name": "Binary Heap",
                "description": "A complete binary tree satisfying the heap property (min-heap or max-heap).",
                "difficulty": "hard",
                "prerequisites": ["binary_trees.types", "binary_trees.traversal.bfs"],
                "sort_order": 10,
            },
        ],
    },
    "tokens_used": 500,
}


# ── Unit test: extract_concept_graph ─────────────────────────────────────


@pytest.mark.asyncio
async def test_extract_concept_graph_binary_trees():
    """Verify extraction produces 8-15 nodes with proper structure."""
    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=BINARY_TREES_GPT_RESPONSE,
    ):
        from engines.concept_extractor import extract_concept_graph

        graph = await extract_concept_graph(
            "Binary Trees",
            "data structures, traversals, properties",
        )

    assert graph.topic == "Binary Trees"
    assert 8 <= len(graph.nodes) <= 15

    # Check node structure
    for node in graph.nodes:
        assert node.key
        assert node.name
        assert node.description
        assert node.difficulty in ("easy", "medium", "hard")
        assert isinstance(node.prerequisites, list)
        assert isinstance(node.sort_order, int)

    # Verify prerequisites reference valid keys
    all_keys = {n.key for n in graph.nodes}
    for node in graph.nodes:
        for prereq in node.prerequisites:
            assert prereq in all_keys, f"Invalid prereq {prereq} in node {node.key}"

    # Check difficulty distribution
    difficulties = {n.difficulty for n in graph.nodes}
    assert "easy" in difficulties
    assert "medium" in difficulties
    assert "hard" in difficulties

    # First node should have no prerequisites
    first_node = min(graph.nodes, key=lambda n: n.sort_order)
    assert first_node.prerequisites == []


# ── API integration tests ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_concept_graph_endpoint(
    client: AsyncClient,
    test_topic: LearningTopic,
    db: AsyncSession,
):
    """POST /api/concepts/{topic_id}/generate creates graph + nodes in DB."""
    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=BINARY_TREES_GPT_RESPONSE,
    ):
        resp = await client.post(f"/api/concepts/{test_topic.id}/generate")

    assert resp.status_code == 201
    data = resp.json()

    assert data["topic_id"] == test_topic.id
    assert "nodes" in data
    assert 8 <= len(data["nodes"]) <= 15

    # Verify nodes stored in DB
    result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == test_topic.id)
    )
    cg = result.scalar_one_or_none()
    assert cg is not None

    nodes_result = await db.execute(
        select(ConceptNode).where(ConceptNode.graph_id == cg.id)
    )
    nodes = nodes_result.scalars().all()
    assert 8 <= len(nodes) <= 15

    # Check a specific node
    definition_node = next((n for n in nodes if n.key == "binary_trees.definition"), None)
    assert definition_node is not None
    assert definition_node.difficulty == "easy"
    assert definition_node.sort_order == 0


@pytest.mark.asyncio
async def test_get_concept_graph_endpoint(
    client: AsyncClient,
    test_topic: LearningTopic,
    db: AsyncSession,
):
    """GET /api/concepts/{topic_id} returns the graph after generation."""
    # Generate first
    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=BINARY_TREES_GPT_RESPONSE,
    ):
        await client.post(f"/api/concepts/{test_topic.id}/generate")

    # Now fetch
    resp = await client.get(f"/api/concepts/{test_topic.id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["topic_id"] == test_topic.id
    assert len(data["nodes"]) == 11


@pytest.mark.asyncio
async def test_list_concept_nodes_endpoint(
    client: AsyncClient,
    test_topic: LearningTopic,
):
    """GET /api/concepts/{topic_id}/nodes returns flat node list."""
    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=BINARY_TREES_GPT_RESPONSE,
    ):
        await client.post(f"/api/concepts/{test_topic.id}/generate")

    resp = await client.get(f"/api/concepts/{test_topic.id}/nodes")
    assert resp.status_code == 200
    nodes = resp.json()
    assert len(nodes) == 11

    # Verify sorted by sort_order
    sort_orders = [n["sort_order"] for n in nodes]
    assert sort_orders == sorted(sort_orders)


@pytest.mark.asyncio
async def test_get_concept_graph_404_when_none(
    client: AsyncClient,
    test_topic: LearningTopic,
):
    """GET /api/concepts/{topic_id} returns 404 when no graph exists."""
    resp = await client.get(f"/api/concepts/{test_topic.id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_generate_replaces_existing_graph(
    client: AsyncClient,
    test_topic: LearningTopic,
    db: AsyncSession,
):
    """Generating again replaces the old graph."""
    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=BINARY_TREES_GPT_RESPONSE,
    ):
        await client.post(f"/api/concepts/{test_topic.id}/generate")
        await client.post(f"/api/concepts/{test_topic.id}/generate")

    # Should only be one graph
    result = await db.execute(
        select(ConceptGraph).where(ConceptGraph.topic_id == test_topic.id)
    )
    graphs = result.scalars().all()
    assert len(graphs) == 1


# ── Concept-aware subgoal generation ─────────────────────────────────────

SUBGOALS_WITH_CONCEPTS_GPT_RESPONSE = {
    "parsed": {
        "subgoals": [
            {
                "title": "Understand binary tree definitions and terminology",
                "description": "Learn what a binary tree is and key terms like root, leaf, and height.",
                "concept_node_key": "binary_trees.definition",
            },
            {
                "title": "Explore different types of binary trees",
                "description": "Study full, complete, perfect, and degenerate binary trees.",
                "concept_node_key": "binary_trees.types",
            },
            {
                "title": "Master in-order and pre-order traversals",
                "description": "Implement and trace DFS traversal algorithms on binary trees.",
                "concept_node_key": "binary_trees.traversal.inorder",
            },
            {
                "title": "Understand level-order (BFS) traversal",
                "description": "Use a queue to traverse a binary tree level by level.",
                "concept_node_key": "binary_trees.traversal.bfs",
            },
            {
                "title": "Learn binary search tree properties and operations",
                "description": "Understand the BST invariant and implement insert/delete.",
                "concept_node_key": "binary_trees.bst",
            },
            {
                "title": "Study balanced trees and heaps",
                "description": "Explore AVL trees and binary heaps as advanced structures.",
                "concept_node_key": "binary_trees.balanced",
            },
        ]
    },
    "tokens_used": 350,
}


@pytest.mark.asyncio
async def test_generate_subgoals_with_concept_nodes(
    client: AsyncClient,
    test_topic: LearningTopic,
    db: AsyncSession,
):
    """POST /api/subgoals/generate uses concept graph when available and saves concept_node_key."""
    # Step 1: Generate a concept graph first
    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=BINARY_TREES_GPT_RESPONSE,
    ):
        cg_resp = await client.post(f"/api/concepts/{test_topic.id}/generate")
    assert cg_resp.status_code == 201

    # Collect valid concept keys from the graph
    cg_data = cg_resp.json()
    valid_concept_keys = {node["key"] for node in cg_data["nodes"]}

    # Step 2: Generate subgoals — mock the subgoal generator's LLM call
    with patch(
        "services.subgoal_generator.json_completion",
        new_callable=AsyncMock,
        return_value=SUBGOALS_WITH_CONCEPTS_GPT_RESPONSE,
    ):
        sg_resp = await client.post(
            "/api/subgoals/generate",
            json={"topic_id": test_topic.id},
        )
    assert sg_resp.status_code == 201
    subgoals = sg_resp.json()

    # Assert that returned subgoals have concept_node_key populated
    keys_in_response = [sg["concept_node_key"] for sg in subgoals if sg.get("concept_node_key")]
    assert len(keys_in_response) >= 1, "At least one subgoal should have concept_node_key"

    # Assert all concept_node_key values reference keys that exist in the concept graph
    for key in keys_in_response:
        assert key in valid_concept_keys, f"concept_node_key '{key}' not in concept graph"

    # Step 3: Verify DB rows also have concept_node_key set
    result = await db.execute(
        select(Subgoal).where(
            Subgoal.topic_id == test_topic.id,
            Subgoal.concept_node_key.isnot(None),
        )
    )
    db_subgoals_with_key = result.scalars().all()
    assert len(db_subgoals_with_key) >= 1

    for sg in db_subgoals_with_key:
        assert sg.concept_node_key in valid_concept_keys


# ── DAG cycle detection tests ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_cycle_detection_breaks_cycles():
    """Verify that cycles in prerequisites are detected and broken."""
    cyclic_response = {
        "parsed": {
            "topic": "Cyclic Test",
            "nodes": [
                {
                    "key": "a",
                    "name": "Node A",
                    "description": "First node",
                    "difficulty": "easy",
                    "prerequisites": ["c"],  # cycle: a -> c -> b -> a
                    "sort_order": 0,
                },
                {
                    "key": "b",
                    "name": "Node B",
                    "description": "Second node",
                    "difficulty": "medium",
                    "prerequisites": ["a"],
                    "sort_order": 1,
                },
                {
                    "key": "c",
                    "name": "Node C",
                    "description": "Third node",
                    "difficulty": "hard",
                    "prerequisites": ["b"],
                    "sort_order": 2,
                },
            ],
        },
        "tokens_used": 100,
    }

    with patch(
        "engines.concept_extractor.json_completion",
        new_callable=AsyncMock,
        return_value=cyclic_response,
    ):
        from engines.concept_extractor import extract_concept_graph

        graph = await extract_concept_graph("Cyclic Test")

    # Graph should still have all 3 nodes
    assert len(graph.nodes) == 3

    # But the prerequisite graph must be a DAG — verify via topological sort
    from engines.concept_extractor import _find_cycle_keys

    remaining_cycles = _find_cycle_keys(graph.nodes)
    assert remaining_cycles == set(), f"Cycles remain: {remaining_cycles}"
