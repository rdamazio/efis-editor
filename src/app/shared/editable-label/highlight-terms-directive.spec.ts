import { Component, input } from '@angular/core';
import { ComponentInput, render, RenderResult, screen } from '@testing-library/angular';
import { HighlightTermsDirective } from './highlight-terms-directive';

@Component({
  selector: 'app-test-host',
  template: ` <div [highlightTerms]="terms()" [highlightClass]="className()" [text]="text()"></div> `,
  imports: [HighlightTermsDirective],
})
class TestHostComponent {
  readonly terms = input<string[]>([]);
  readonly className = input<string>('highlight');
  readonly text = input<string>('Hello world, this is a test.');
}

describe('HighlightTermsDirective', () => {
  let renderResult: RenderResult<TestHostComponent>;

  beforeEach(async () => {
    renderResult = await render(TestHostComponent, {
      inputs: {
        terms: [],
        className: 'highlight',
        text: 'Hello world, this is a test.',
      },
    });
  });

  async function changeInputs(inputs: ComponentInput<TestHostComponent>) {
    return renderResult.rerender({ inputs: inputs, partialUpdate: true });
  }

  it('should create an instance', () => {
    expect(renderResult.container).toBeTruthy();
  });

  it('should not initially highlight anything when terms is empty', async () => {
    expect(screen.getByText('Hello world, this is a test.')).toBeTruthy();

    expect(screen.queryByText((content, element) => element?.tagName.toLowerCase() === 'mark')).toBeNull();
  });

  it('should highlight terms', async () => {
    await changeInputs({ terms: ['world', 'test'] });

    const worldMark = await screen.findByText('world');
    const testMark = await screen.findByText('test');

    expect(worldMark.tagName).toBe('MARK');
    expect(worldMark).toHaveClass('highlight');
    expect(testMark.tagName).toBe('MARK');
    expect(testMark).toHaveClass('highlight');

    // Check that non-highlighted text is outside the <mark>
    expect(renderResult.container.innerHTML).toContain(
      'Hello <mark class="highlight">world</mark>, this is a <mark class="highlight">test</mark>.',
    );
  });

  it('should be case-insensitive', async () => {
    await changeInputs({ terms: ['WORLD'] });

    const worldMark = await screen.findByText('world');
    expect(worldMark.tagName).toBe('MARK');
    expect(worldMark).toHaveClass('highlight');
  });

  it('should handle dynamic content changes', async () => {
    await changeInputs({ terms: ['world'] });

    await expect(screen.findByText('world')).resolves.toHaveClass('highlight');

    // Change content
    await changeInputs({ text: 'Hello world again.' });

    await expect(screen.findByText('world')).resolves.toHaveClass('highlight');
  });

  it('should handle dynamic content changes that remove highlights', async () => {
    await changeInputs({ terms: ['world', 'test'] });

    await expect(screen.findByText('world')).resolves.toHaveClass('highlight');
    await expect(screen.findByText('test')).resolves.toHaveClass('highlight');

    // Change content
    await changeInputs({ text: 'Hello world again.' });

    await expect(screen.findByText('world')).resolves.toHaveClass('highlight');
    expect(screen.queryByText('test')).toBeNull();
  });

  it('should handle dynamic content changes that create new highlights', async () => {
    await changeInputs({ terms: ['again'] });

    expect(screen.queryByText('again')).toBeNull();

    // Change content
    await changeInputs({ text: 'Hello world again.' });

    await expect(screen.findByText('again')).resolves.toHaveClass('highlight');
  });

  it('should handle input changes', async () => {
    await changeInputs({ terms: ['world'] });

    await expect(screen.findByText('world')).resolves.toHaveClass('highlight');
    expect(screen.queryByText('test')).toBeNull();

    // Change terms
    await changeInputs({ terms: ['test'] });

    await expect(screen.findByText('test')).resolves.toHaveClass('highlight');
    expect(screen.queryByText('world')).toBeNull();
  });
});
