import { ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { ChecklistFilePickerComponent } from './file-picker.component';

describe('FilePickerComponent', () => {
  let user: UserEvent;
  let fileSelected: Mock;

  beforeEach(() => {
    user = userEvent.setup();
    fileSelected = vi.fn();
  });

  async function setupPicker(
    fileNames: string[],
    selectedFile?: string,
  ): Promise<ComponentFixture<ChecklistFilePickerComponent>> {
    const { fixture } = await render(ChecklistFilePickerComponent, {
      providers: [provideNoopAnimations()],
      inputs: { fileNames: fileNames, selectedFile: selectedFile },
      on: { fileSelected },
    });
    return fixture;
  }

  it('should render', async () => {
    await setupPicker([]);

    expect(screen.queryByText('Select checklist file')).toBeVisible();
  });

  it('should render the selected file', async () => {
    await setupPicker(['File 1', 'File 2'], 'File 2');

    expect(await screen.findByText('File 2')).toBeVisible();
  });

  it('should change the selected file', async () => {
    const fixture = await setupPicker(['File 1', 'File 2'], 'File 2');

    const combo = await screen.findByRole('combobox', { name: /Select checklist file.*/ });
    expect(combo).toBeVisible();
    await user.click(combo);

    const file1 = await screen.findByRole('option', { name: 'File 1' });
    expect(file1).toBeVisible();
    await user.click(file1);

    expect(fileSelected).toHaveBeenCalledTimes(1);

    expect(fileSelected).toHaveBeenCalledWith('File 1');
    expect(fixture.componentInstance.selectedFile()).toEqual('File 1');
  });
});
