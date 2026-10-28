---
description: 'Guidelines for building Porthole features'
applyTo: '**/*.java, **/*.kt, **/*.ts, **/*.tsx'
---

# Architecture and Design Principles

The system is a tool to design landscapes that are hexagonal maps.

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
- the user interface should be intuitive and easy to navigate, with clear buttons

## General Instructions

- be brief, no pleasantries
- Make only high confidence suggestions when reviewing code changes.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- Use hexagonal architecture principles to separate concerns and improve testability.

## Technical Stack

- use Gradle
- use react with three.js for the client side
- use micronaut for the server side

## Code Reviews
- review code before merging to ensure it adheres to the architecture and design principles outlined above
- provide constructive feedback and suggestions for improvement