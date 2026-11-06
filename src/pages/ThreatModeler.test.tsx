import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ThreatModeler } from './ThreatModeler'

function renderLesson() {
  return render(
    <MemoryRouter initialEntries={['/threat-modeler/script-injection']}>
      <Routes>
        <Route path="/threat-modeler/:scenarioId?" element={<ThreatModeler />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Threat modeler', () => {
  it('steps through the lesson with the mouse and the keyboard', async () => {
    const user = userEvent.setup()
    renderLesson()
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText(/Step 2 of 2/)).toBeInTheDocument()
    screen.getByLabelText('Attack timeline').focus()
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fixed' }))
    expect(screen.getByRole('heading', { name: 'Fixed workflow' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Diff from the vulnerable workflow' })).toBeInTheDocument()
  })
})