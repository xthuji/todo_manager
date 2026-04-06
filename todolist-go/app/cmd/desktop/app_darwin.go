//go:build darwin

package main

// #cgo CFLAGS: -x objective-c
// #cgo LDFLAGS: -framework Cocoa
// #include <Cocoa/Cocoa.h>
// void setupQuitMenu() {
//     NSApplication *app = [NSApplication sharedApplication];
//     NSMenu *menuBar = [[NSMenu alloc] initWithTitle:@""];
//     NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
//     NSMenu *appMenu = [[NSMenu alloc] initWithTitle:@""];
//     NSMenuItem *quitMenuItem = [[NSMenuItem alloc] initWithTitle:@"Quit TodoManager" 
//                                                       action:@selector(terminate:) 
//                                                keyEquivalent:@"q"];
//     [appMenu addItem:quitMenuItem];
//     [appMenuItem setSubmenu:appMenu];
//     [menuBar addItem:appMenuItem];
//     [app setMainMenu:menuBar];
//     [menuBar release];
//     [appMenuItem release];
//     [appMenu release];
//     [quitMenuItem release];
// }
import "C"

// 在macOS上覆盖默认的setupQuitHandler函数
func init() {
	setupQuitHandler = func(window interface{}) {
		// 直接调用C函数设置退出菜单
		C.setupQuitMenu()
	}
}