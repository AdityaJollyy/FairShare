/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import * as d3 from 'd3';
import AuthContext from '../../context/AuthContext';
import './DebtGraphStyles.css';

const SettlementPlan = () => {
    const { groupId } = useParams();
    const { socket } = useContext(AuthContext);
    const [group, setGroup] = useState(null);
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const graphRef = useRef(null);

    // Define fetchData as a reusable function with useCallback
    const fetchData = useCallback(async () => {
        try {
            // Get group details
            const groupRes = await axios.get(`/groups/${groupId}`);
            setGroup(groupRes.data);

            // Get settlement plan
            const settlementRes = await axios.get(`/expenses/settlement/${groupId}`);
            // Sort settlements by date in descending order if they have date information
            const sortedSettlements = settlementRes.data.sort((a, b) => {
                // If date information is available, sort by it
                if (a.date && b.date) {
                    return new Date(b.date) - new Date(a.date);
                }
                return 0; // Keep original order if no date information
            });
            setSettlements(sortedSettlements);

            setLoading(false);
        } catch (err) {
            setError('Error fetching settlement data');
            console.error('Error fetching settlement data:', err);
            setLoading(false);
        }
    }, [groupId]);
    // Fetch group and settlement data
    useEffect(() => {
        fetchData();

        // Set up a polling interval as a backup for real-time updates
        const intervalId = setInterval(() => {
            console.log('Polling for settlement updates');
            fetchData();
        }, 30000);

        // Cleanup
        return () => {
            clearInterval(intervalId);
        };
    }, [fetchData]);

    // Set up socket listeners when socket changes
    useEffect(() => {
        // Skip if no socket or not connected
        if (!socket) {
            console.log('No socket available for settlement updates');
            return;
        }

        // Only setup listeners when socket is connected
        const setupSocketListeners = () => {
            // Join the group room
            socket.emit('join_group', groupId);
            console.log(`Joined group ${groupId} for settlement updates`);

            // Listen for expense changes that would affect the settlement plan
            socket.on('expense_added', () => {
                console.log('New expense added, refreshing settlement plan');
                fetchData();
            });

            socket.on('expense_deleted', () => {
                console.log('Expense deleted, refreshing settlement plan');
                fetchData();
            });

            socket.on('settlement_update', () => {
                console.log('Settlement update, refreshing settlement plan');
                fetchData();
            });

            // Also listen for member changes that might affect settlements
            socket.on('member_added', (data) => {
                if (data.groupId === groupId) {
                    console.log('Member added, refreshing settlement plan');
                    fetchData();
                }
            });

            socket.on('member_removed', (data) => {
                if (data.groupId === groupId) {
                    console.log('Member removed, refreshing settlement plan');
                    fetchData();
                }
            });
        };

        // Add connection listener
        socket.on('connect', setupSocketListeners);

        // Setup listeners immediately if already connected
        if (socket.connected) {
            setupSocketListeners();
        }

        // Cleanup
        return () => {
            if (socket.connected) {
                socket.emit('leave_group', groupId);
                socket.off('expense_added');
                socket.off('expense_deleted');
                socket.off('settlement_update');
                socket.off('member_added');
                socket.off('member_removed');
                socket.off('connect');
            }
        };
    }, [socket, groupId, fetchData]);

    // Create graph visualization when data is loaded
    useEffect(() => {
        if (!loading && settlements.length > 0 && graphRef.current) {
            createGraph();
        }
    }, [loading, settlements]); // Removed createGraph from dependencies
    // Define createGraph with useCallback to properly handle dependencies
    const createGraph = useCallback(() => {
        // Clear previous graph
        d3.select(graphRef.current).selectAll('*').remove();

        // Get the container width
        const container = graphRef.current;
        const containerRect = container.getBoundingClientRect();
        const width = containerRect.width || 900;
        const height = 600; // Increased height for better visibility with many nodes

        // Create SVG with zoom functionality
        const svg = d3.select(graphRef.current)
            .append('svg')
            .attr('width', '100%')
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // Add zoom behavior with wider scale extent for larger groups
        const zoom = d3.zoom()
            .scaleExtent([0.05, 5]) // Allow zooming out more for larger groups
            .on('zoom', (event) => {
                g.attr('transform', event.transform);
            });

        svg.call(zoom);

        // Initial zoom out for better visibility with many nodes
        const memberCount = group?.members?.length || 0;
        if (memberCount > 5) {
            // Auto zoom out more as node count increases
            const initialScale = Math.max(0.6, 1 - (memberCount * 0.05));
            svg.call(zoom.transform, d3.zoomIdentity.scale(initialScale));
        }

        // Add zoom controls
        const zoomControls = svg.append('g')
            .attr('class', 'zoom-controls')
            .attr('transform', `translate(${width - 80}, 20)`);

        zoomControls.append('rect')
            .attr('width', 60)
            .attr('height', 60)
            .attr('rx', 5)
            .attr('fill', 'rgba(255, 255, 255, 0.7)');

        zoomControls.append('text')
            .attr('x', 30)
            .attr('y', 20)
            .attr('text-anchor', 'middle')
            .attr('cursor', 'pointer')
            .text('🔍+')
            .on('click', () => {
                svg.transition().duration(300).call(zoom.scaleBy, 1.3);
            });

        zoomControls.append('text')
            .attr('x', 30)
            .attr('y', 40)
            .attr('text-anchor', 'middle')
            .attr('cursor', 'pointer')
            .text('🔍-')
            .on('click', () => {
                svg.transition().duration(300).call(zoom.scaleBy, 0.7);
            });

        zoomControls.append('text')
            .attr('x', 30)
            .attr('y', 57)
            .attr('text-anchor', 'middle')
            .attr('cursor', 'pointer')
            .text('🔄')
            .on('click', () => {
                svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity);
            });

        // Create a group for the graph elements that will be transformed during zoom
        const g = svg.append('g');        // Create nodes (users)
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
        }));        // Create force simulation with adjustable parameters based on node count
        const nodeCount = nodes.length;
        const linkDistance = Math.max(120, Math.min(220, 650 / nodeCount)); // Adjusted distance based on node count
        const chargeStrength = Math.max(-900, Math.min(-400, -120 * nodeCount)); // Stronger repulsion for better spacing

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(45)) // Increased radius to prevent node-label overlap
            .on('tick', ticked);

        // Create links - fixed width regardless of amount
        const link = g.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', '#999')
            .attr('stroke-width', 2) // Fixed width
            .attr('stroke-opacity', 0.6);        // Create nodes with improved styling
        const node = g.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter()
            .append('circle')
            .attr('r', 15) // Slightly larger nodes
            .attr('fill', d => {
                // Better color scale for nodes
                const colors = ['#4682B4', '#6495ED', '#1E90FF', '#87CEFA', '#7B68EE', '#BA55D3', '#FF69B4'];
                return colors[nodes.indexOf(d) % colors.length];
            })
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));// Add labels with better positioning and background
        const labelGroup = g.append('g')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node-label');        // Label background for better readability
        labelGroup.append('rect')
            .attr('fill', 'white')
            .attr('opacity', 0.95)
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('stroke', '#ddd')
            .attr('stroke-width', 1);

        const labels = labelGroup.append('text')
            .text(d => d.name)
            .attr('font-size', 12)
            .attr('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('dx', 0)
            .attr('dy', 0)
            .attr('fill', '#333');

        // Calculate and position the background rectangles based on text size
        labelGroup.selectAll('rect')
            .attr('width', function () {
                return this.parentNode.querySelector('text').getBBox().width + 16;
            })
            .attr('height', function () {
                return this.parentNode.querySelector('text').getBBox().height + 10;
            })
            .attr('x', function () {
                return this.parentNode.querySelector('text').getBBox().x - 8;
            })
            .attr('y', function () {
                return this.parentNode.querySelector('text').getBBox().y - 5;
            });        // Add arrows for direction
        g.append('defs').selectAll('marker')
            .data(links)
            .enter()
            .append('marker')
            .attr('id', (d, i) => `arrow-${i}`)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 26) // Position adjusted for larger nodes
            .attr('refY', 0)
            .attr('markerWidth', 8)  // Increased size
            .attr('markerHeight', 8) // Increased size
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#999');

        link.attr('marker-end', (d, i) => `url(#arrow-${i})`);

        // Add amount labels with improved visibility
        const linkLabels = g.append('g')
            .selectAll('g')
            .data(links)
            .enter()
            .append('g')
            .attr('class', 'amount-label'); linkLabels.append('rect')
                .attr('fill', '#f8f8f8')
                .attr('opacity', 0.95)
                .attr('rx', 10)
                .attr('ry', 10)
                .attr('stroke', '#ccc')
                .attr('stroke-width', 0.5);

        const amountTexts = linkLabels.append('text')
            .text(d => `₹${d.value.toFixed(0)}`) // Simplified rupee amount
            .attr('font-size', 11)
            .attr('font-weight', 'bold')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#444');

        // Calculate and position the background rectangles for amount labels
        linkLabels.selectAll('rect')
            .attr('width', function () {
                return this.parentNode.querySelector('text').getBBox().width + 16;
            })
            .attr('height', function () {
                return this.parentNode.querySelector('text').getBBox().height + 10;
            })
            .attr('x', function () {
                return this.parentNode.querySelector('text').getBBox().x - 8;
            })
            .attr('y', function () {
                return this.parentNode.querySelector('text').getBBox().y - 5;
            }); function ticked() {
                link
                    .attr('x1', d => d.source.x)
                    .attr('y1', d => d.source.y)
                    .attr('x2', d => d.target.x)
                    .attr('y2', d => d.target.y);

                node
                    .attr('cx', d => d.x)
                    .attr('cy', d => d.y);

                // Position labels to avoid arrow overlap
                labelGroup.attr('transform', d => {
                    // Get all links connected to this node
                    const nodeLinks = links.filter(link =>
                        link.source.id === d.id || link.target.id === d.id
                    );

                    // Calculate directions of connected links
                    const hasIncoming = nodeLinks.some(link => link.target.id === d.id);
                    const hasOutgoing = nodeLinks.some(link => link.source.id === d.id);

                    // Determine label position based on connections
                    let offsetX = 0;
                    let offsetY = -30; // Position label above node by default, increased distance

                    if (hasIncoming && !hasOutgoing) {
                        // If node only has incoming links, position label on the right
                        offsetX = 35; // Increased offset
                        offsetY = 0;
                    } else if (hasOutgoing && !hasIncoming) {
                        // If node only has outgoing links, position label on the left
                        offsetX = -35; // Increased offset
                        offsetY = 0;
                    } else if (hasIncoming && hasOutgoing) {
                        // If node has both incoming and outgoing links, position above
                        offsetX = 0;
                        offsetY = -35; // Increased offset
                    }

                    return `translate(${d.x + offsetX}, ${d.y + offsetY})`;
                });

                // Position amount labels with improved offset from the midpoint
                linkLabels
                    .attr('transform', d => {
                        // Calculate midpoint of the link
                        const midX = (d.source.x + d.target.x) / 2;
                        const midY = (d.source.y + d.target.y) / 2;

                        // Calculate vector perpendicular to the link for offset
                        const dx = d.target.x - d.source.x;
                        const dy = d.target.y - d.source.y;
                        const len = Math.sqrt(dx * dx + dy * dy);

                        // Apply perpendicular offset (only if there's a reasonable length)
                        let offsetX = 0;
                        let offsetY = 0;
                        if (len > 0) {
                            // Normalize and apply offset perpendicular to the link
                            offsetX = -dy / len * 15; // Offset amount
                            offsetY = dx / len * 15;  // Offset amount
                        }

                        return `translate(${midX + offsetX}, ${midY + offsetY})`;
                    });
            }

        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        } function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
    }, [group, settlements]); // Keep these dependencies stable
    if (loading) {
        return <div className="container">Loading...</div>;
    }

    return (
        <section className="container">
            <Link to={`/groups/${groupId}`} className="btn btn-light mb-3">
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
                                You can drag nodes to rearrange and use the controls in the top right to zoom in/out.
                            </p>
                            <div className="graph-container" ref={graphRef}></div>
                            <p className="graph-instructions">
                                <small>💡 Tip: Drag nodes to rearrange. Use 🔍+/- buttons to zoom in/out, and 🔄 to reset the view.</small>
                            </p>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default SettlementPlan;