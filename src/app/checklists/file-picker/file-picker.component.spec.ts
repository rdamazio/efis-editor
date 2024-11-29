import { render, RenderResult, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { ChecklistFilePickerComponent } from './file-picker.component';

describe('FilePickerComponent', () => {
  let user: UserEvent;
  let fileSelected: jasmine.Spy;

  beforeEach(() => {
    user = userEvent.setup();
    fileSelected = jasmine.createSpy('fileSelected');
  });

  async function renderComponent(
    fileNames: string[],
    selectedFile?: string,
  ): Promise<RenderResult<ChecklistFilePickerComponent>> {
    return render(ChecklistFilePickerComponent, {
      inputs: {
        fileNames: fileNames,
        selectedFile: selectedFile,
      },
      on: {
        fileSelected,
      },
    });
  }

  it('should render', async () => {
    await renderComponent([]);

    expect(screen.queryByText('Select checklist file')).toBeVisible();
  });

  it('should render the selected file', async () => {
    await renderComponent(['File 1', 'File 2'], 'File 2');

    expect(await screen.findByText('File 2')).toBeVisible();
  });

  it('should change the selected file', async () => {
    const rendered = await renderComponent(['File 1', 'File 2'], 'File 2');

    const combo = await screen.findByRole('combobox', { name: /Select checklist file.*/ });
    expect(combo).toBeVisible();
    await user.click(combo);

    const file1 = await screen.findByRole('option', { name: 'File 1' });
    expect(file1).toBeVisible();
    await user.click(file1);

    expect(fileSelected).toHaveBeenCalledOnceWith('File 1');
    expect(rendered.fixture.componentInstance.selectedFile()).toEqual('File 1');
  });
});
