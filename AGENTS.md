---
description: 'Guidelines for building Micronaut base applications'
applyTo: '**/*.java, **/*.kt, **/*.ts, **/*.tsx'
---

# Architecture and Design Principles

- client / server architecture
- REST API design
- security best practices
- server controls logic and state management
- client handles user interface and interactions
- use WebSockets for real-time updates between client and server
- implement authentication and authorization for player accounts
- use JWT tokens for secure communication between client and server
- implement unit and integration tests to ensure code quality and reliability
- extract business logic into separate classes to improve maintainability and testability

## General Instructions

- be brief, no pleasantries
- Make only high confidence suggestions when reviewing code changes.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- Use hexagonal architecture principles to separate concerns and improve testability.

## Technical Stack

- use maven
- use react with three.js for the client side
- use micronaut for the server side


## Domain rules

- The system is a tool to design landscapes that are hexagonal maps. The hex tiles do not have terrain, but elevation.
- Towers can be placed on the map and connections can be drawn between towers.


## Appearance
- tiles are hexagonal and appear with blue glowing edges
- towers are represented as 3D models that can be placed on top of the hexagonal
- the user interface should be intuitive and easy to navigate, with clear buttons for placing towers,

## Code Reviews
- review code before merging to ensure it adheres to the architecture and design principles outlined above
- provide constructive feedback and suggestions for improvement