import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import * as d3 from 'd3';

const SettlementPlan = () => {
    const { groupId } = useParams();
    const [group, setGroup] = useState(null);
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const graphRef = useRef(null);

    // Fetch group and settlement data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Get group details
                const groupRes = await axios.get(`/groups/${groupId}`);
                setGroup(groupRes.data);

                // Get settlement plan
                const settlementRes = await axios.get(`/expenses/settlement/${groupId}`);
                setSettlements(settlementRes.data);

                setLoading(false);
            } catch (err) {
                setError('Error fetching settlement data');
                console.error('Error fetching settlement data:', err);
                setLoading(false);
            }
        };

        fetchData();
    }, [groupId]);

    // Create graph visualization
    useEffect(() => {
        if (!loading && settlements.length > 0 && graphRef.current) {
            createGraph();
        }
    }, [loading, settlements]);

    const createGraph = () => {
        // Clear previous graph
        d3.select(graphRef.current).selectAll('*').remove();

        const width = 600;
        const height = 400;

        // Create SVG
        const svg = d3.select(graphRef.current)
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        // Create nodes (users)
        const nodes = [];
        const nodeMap = {};

        if (group && group.members) {
            group.members.forEach(member => {
                const node = {
                    id: member.user,
                    name: member.name,
                    x: Math.random() * width,
                    y: Math.random() * height
                };
                nodes.push(node);
                nodeMap[member.user] = node;
            });
        }

        // Create links (settlements)
        const links = settlements.map(settlement => ({
            source: settlement.from.id,
            target: settlement.to.id,
            value: settlement.amount
        }));

        // Create force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .on('tick', ticked);

        // Create links
        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-width', d => Math.sqrt(d.value) / 2);

        // Create nodes
        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('r', 10)
            .attr('fill', '#69b3a2')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        // Add labels
        const label = svg.append('g')
            .selectAll('text')
            .data(nodes)
            .enter()
            .append('text')
            .text(d => d.name)
            .attr('font-size', 12)
            .attr('dx', 15)
            .attr('dy', 4);

        // Add arrows for direction
        svg.append('defs').selectAll('marker')
            .data(links)
            .enter()
            .append('marker')
            .attr('id', (d, i) => `arrow-${i}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 20)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');

        link.attr('marker-end', (d, i) => `url(#arrow-${i})`);

        // Add amount labels
        const linkLabels = svg.append('g')
            .selectAll('text')
            .data(links)
            .enter()
            .append('text')
            .text(d => `Rs. ${d.value.toFixed(2)}`)
            .attr('font-size', 10)
            .attr('fill', '#333');

        function ticked() {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            label
                .attr('x', d => d.x)
                .attr('y', d => d.y);

            linkLabels
                .attr('x', d => (d.source.x + d.target.x) / 2)
                .attr('y', d => (d.source.y + d.target.y) / 2);
        }

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    };

    if (loading) {
        return <div className="container">Loading...</div>;
    }

    return (
        <section className="container">
            <Link to={`/groups/${groupId}`} className="btn btn-light">
                Back to Group
            </Link>

            <h1>Settlement Plan</h1>
            <p>Group: {group && group.name}</p>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="settlement-content">
                {settlements.length === 0 ? (
                    <p>No settlements needed! Everyone is settled up.</p>
                ) : (
                    <>
                        <div className="settlement-list">
                            <h3>Optimal Settlement Plan</h3>
                            <p className="settlement-explanation">
                                This plan uses graph algorithms to minimize the number of transactions needed to settle all debts.
                            </p>
                            <ul>
                                {settlements.map((settlement, index) => (
                                    <li key={index} className="settlement-item">
                                        <strong>{settlement.from.name}</strong> pays <strong>Rs. {settlement.amount.toFixed(2)}</strong> to <strong>{settlement.to.name}</strong>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="settlement-graph">
                            <h3>Debt Graph Visualization</h3>
                            <p className="graph-explanation">
                                This graph shows who owes money to whom. Arrows indicate the direction of payment.
                            </p>
                            <div className="graph-container" ref={graphRef}></div>
                            <p className="graph-instructions">
                                <small>You can drag the nodes to rearrange the graph.</small>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default SettlementPlan; 