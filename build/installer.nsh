!macro customInstall
  DetailPrint "Register skyoo URI Handler"
  DeleteRegKey HKCR "skyoo"
  WriteRegStr HKCR "skyoo" "" "URL:Skyoo Protocol"
  WriteRegStr HKCR "skyoo" "URL Protocol" ""
  WriteRegStr HKCR "skyoo\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  WriteRegStr HKCR "skyoo\shell" "" ""
  WriteRegStr HKCR "skyoo\shell\Open" "" ""
  WriteRegStr HKCR "skyoo\shell\Open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
!macroend

!macro customRemoveFiles
  DeleteRegKey HKCR "skyoo"
  Push $R1
  Push $R2

  FindFirst $R1 $R2 "$INSTDIR\*.*"

  ;IfFileExists "$INSTDIR\app\*.*" loop not_app
  ;not_app:
  ;  RMDir /r $INSTDIR
  ;  Goto done

  loop:
    StrCmp $R2 "" done

    StrCmp $R2 "." continue
    StrCmp $R2 ".." continue
    StrCmp $R2 "app" continue

    Delete "$INSTDIR\$R2"
    RMDir /r "$INSTDIR\$R2"

    Goto continue

    continue:
      FindNext $R1 $R2
      Goto loop

  done:
    FindClose $R1
    Pop $R1
    Pop $R2
!macroend
