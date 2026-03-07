import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { render, screen } from '@testing-library/angular';
import userEvent, { UserEvent } from '@testing-library/user-event';
import type { Mock } from 'vitest';
import { ChecklistCommandBarComponent } from './command-bar.component';

import { FormatId } from '../../../model/formats/format-id';

describe('ChecklistCommandBarComponent', () => {
  let loader: HarnessLoader;
  let newButton: HTMLButtonElement;
  let openButton: HTMLButtonElement;
  let uploadButton: HTMLButtonElement;
  let downloadButton: HTMLButtonElement;
  let printButton: HTMLButtonElement;
  let deleteButton: HTMLButtonElement;
  let infoButton: HTMLButtonElement;
  let newFile: Mock;
  let openFile: Mock;
  let uploadFile: Mock;
  let downloadFile: Mock;
  let deleteFile: Mock;
  let fileInfo: Mock;
  let user: UserEvent;

  beforeEach(() => {
    newFile = vi.fn();
    openFile = vi.fn();
    uploadFile = vi.fn();
    downloadFile = vi.fn();
    deleteFile = vi.fn();
    fileInfo = vi.fn();

    user = userEvent.setup();
  });

  async function renderComponent(hasFiles: boolean, fileIsOpen: boolean) {
    const { fixture } = await render(ChecklistCommandBarComponent, {
      providers: [provideNoopAnimations()],
      inputs: { hasFiles: hasFiles, fileIsOpen: fileIsOpen },
      on: { newFile, openFile, uploadFile, downloadFile, deleteFile, fileInfo },
    });

    newButton = screen.queryByRole('button', { name: 'New file' })!;
    openButton = screen.queryByRole('button', { name: 'Open file' })!;
    uploadButton = screen.queryByRole('button', { name: 'Upload file' })!;
    downloadButton = screen.queryByRole('button', { name: 'Download file' })!;
    printButton = screen.queryByRole('button', { name: 'Print file' })!;
    deleteButton = screen.queryByRole('button', { name: 'Delete file' })!;
    infoButton = screen.queryByRole('button', { name: 'Open file information dialog' })!;

    expect(newButton).toBeInTheDocument();
    expect(openButton).toBeInTheDocument();
    expect(uploadButton).toBeInTheDocument();
    expect(downloadButton).toBeInTheDocument();
    expect(printButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    expect(infoButton).toBeInTheDocument();

    loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
  }

  it('should render in initial app state', async () => {
    await renderComponent(false, false);

    expect(newButton).toBeEnabled();
    expect(openButton).toBeDisabled();
    expect(uploadButton).toBeEnabled();
    expect(downloadButton).toBeDisabled();
    expect(printButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(infoButton).toBeDisabled();
  });

  it('should render with files but none opened', async () => {
    await renderComponent(true, false);

    expect(newButton).toBeEnabled();
    expect(openButton).toBeEnabled();
    expect(uploadButton).toBeEnabled();
    expect(downloadButton).toBeDisabled();
    expect(printButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
    expect(infoButton).toBeDisabled();
  });

  it('should render when a file is open', async () => {
    await renderComponent(true, true);

    expect(newButton).toBeEnabled();
    expect(openButton).toBeEnabled();
    expect(uploadButton).toBeEnabled();
    expect(downloadButton).toBeEnabled();
    expect(printButton).toBeEnabled();
    expect(deleteButton).toBeEnabled();
    expect(infoButton).toBeEnabled();
  });

  it('should emit when Open is clicked', async () => {
    await renderComponent(true, false);
    await user.click(openButton);
    expect(openFile).toHaveBeenCalledTimes(1);
    expect(openFile).toHaveBeenCalledWith(true);
  });

  it('should emit when Upload is clicked', async () => {
    await renderComponent(true, false);
    await user.click(uploadButton);
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledWith(true);
  });

  it('should emit when Print is clicked', async () => {
    await renderComponent(true, true);
    await user.click(printButton);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(downloadFile).toHaveBeenCalledWith(FormatId.PDF);
  });

  it('should emit when Info is clicked', async () => {
    await renderComponent(true, true);
    await user.click(infoButton);
    expect(fileInfo).toHaveBeenCalledTimes(1);
    expect(fileInfo).toHaveBeenCalledWith(true);
  });

  it('should emit when New is clicked', async () => {
    await renderComponent(true, true);
    await user.click(newButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveLength(1);

    const titleBox = await screen.findByRole('textbox', { name: 'Title' });
    expect(titleBox).toBeVisible();
    await user.type(titleBox, 'New title[Enter]');

    expect(newFile).toHaveBeenCalledTimes(1);

    expect(newFile).toHaveBeenCalledWith('New title');
  });

  it('should emit when Download is clicked', async () => {
    await renderComponent(true, true);
    await user.click(downloadButton);

    const menu = await loader.getHarness(MatMenuHarness.with({ triggerText: 'download' }));
    expect(await menu.isOpen()).toBe(true);

    const formatButton = await screen.findByRole('menuitem', { name: 'Download as Jeppesen ForeFlight' });
    expect(formatButton).toBeVisible();
    await user.click(formatButton);

    expect(downloadFile).toHaveBeenCalledTimes(1);

    expect(downloadFile).toHaveBeenCalledWith(FormatId.FOREFLIGHT);
  });

  it('should emit when Delete is clicked', async () => {
    await renderComponent(true, true);
    await user.click(deleteButton);

    const dialogs = await loader.getAllHarnesses(MatDialogHarness);
    expect(dialogs).toHaveLength(1);

    const confirmButton = await screen.findByRole('button', { name: 'Delete!' });
    expect(confirmButton).toBeVisible();
    await user.click(confirmButton);

    expect(deleteFile).toHaveBeenCalledTimes(1);

    expect(deleteFile).toHaveBeenCalledWith(true);
  });
});
