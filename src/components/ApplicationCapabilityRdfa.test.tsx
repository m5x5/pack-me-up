import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import React from 'react'
import { ApplicationCapabilityRdfa } from './ApplicationCapabilityRdfa'
import { APPLICATION, CAPABILITIES, REQUIREMENTS } from '../capability/document'

describe('ApplicationCapabilityRdfa', () => {
    afterEach(() => {
        cleanup()
    })

    it('declares the vocabulary prefixes the markup below relies on', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        const root = container.querySelector('[typeof="ac:Application"]')!
        expect(root.getAttribute('prefix')).toContain('ac: https://www.w3.org/ns/ac#')
        expect(root.getAttribute('prefix')).toContain('pmu: https://pack-me-up.app/vocab#')
    })

    it('identifies the application by its own IRI and name', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        const root = container.querySelector('[typeof="ac:Application"]')!
        expect(root.getAttribute('resource')).toBe(APPLICATION.id)
        expect(container.querySelector('[property="as:name"]')?.getAttribute('content')).toBe('Pack Me Up')
    })

    it('restates every capability from the negotiated document as ac:Capability', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        const capabilities = container.querySelectorAll('[property="ac:capability"]')
        expect(capabilities.length).toBe(CAPABILITIES.length)

        for (const capability of CAPABILITIES) {
            const node = container.querySelector(`[typeof="ac:Capability"][resource="${capability.id}"]`)
            expect(node).not.toBeNull()
            expect(node!.querySelector('[property="ac:action"]')?.getAttribute('resource')).toBe(capability.action)
            expect(node!.querySelector('[property="ac:output"]')?.getAttribute('content')).toBe(capability.output)
            expect(node!.querySelector('link[property="ac:resourceType"]')?.getAttribute('resource')).toBe(capability.resourceType)
        }
    })

    it('nests each capability\'s invocation as an ac:UriTemplateInvocation with its hydra:template', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        const capability = CAPABILITIES.find(c => c.id.endsWith('capability-view-packing-list'))!
        const capabilityNode = container.querySelector(`[resource="${capability.id}"]`)!
        const invocationNode = capabilityNode.querySelector('[typeof="ac:UriTemplateInvocation"]')!

        expect(invocationNode.getAttribute('resource')).toBe(capability.invocation)
        expect(invocationNode.querySelector('[property="hydra:template"]')?.getAttribute('content')).toBe('#open-packing-list={open}')
    })

    it('only points ac:shape at capabilities that actually declare a shape', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        const withShape = CAPABILITIES.find(c => c.shape)!
        const withoutShape = CAPABILITIES.find(c => !c.shape)!

        expect(container.querySelector(`[resource="${withShape.id}"] link[property="ac:shape"]`)).not.toBeNull()
        expect(container.querySelector(`[resource="${withoutShape.id}"] link[property="ac:shape"]`)).toBeNull()
    })

    it('restates every requirement as an ac:Requirement with its purpose', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        for (const requirement of REQUIREMENTS) {
            const node = container.querySelector(`[typeof="ac:Requirement"][resource="${requirement.id}"]`)
            expect(node).not.toBeNull()
            expect(node!.querySelector('[property="dpv:hasPurpose"]')?.getAttribute('resource')).toBe(requirement.hasPurpose)
        }
    })

    it('renders nothing visible, since every element is empty or a <meta>/<link>', () => {
        const { container } = render(<ApplicationCapabilityRdfa />)

        expect(container.textContent).toBe('')
    })
})
