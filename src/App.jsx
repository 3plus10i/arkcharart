import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Select, Button, Card, Row, Col, Slider, Image as AntImage, message, Upload, Radio, Tooltip, Space, Spin, Modal, Form, Input } from 'antd'
import { DownloadOutlined, ReloadOutlined, UploadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import iconUrl from '/icon.png'
import { composeImage } from './lib/composeImage'
import { BG_FILENAME } from './config'
import { factions, factionExtMap } from './data/faction'
import { codeToName } from './lib/artListManager'
import { parseArtFilename } from './lib/parseArtFile'

const { Option } = Select

function App() {
  // ==================== 参数状态 ====================
  const [charScale, setCharScale] = useState(1)
  const [charPos, setCharPos] = useState(0.5)
  const [charYOffset, setCharYOffset] = useState(0.5)
  const [logoScale, setLogoScale] = useState(1)
  const [selectedFaction, setSelectedFaction] = useState(null) // null=本家, ''=无logo, 其他=指定势力
  const [outputQuality, setOutputQuality] = useState('4K')

  // 预览状态
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const canvasRef = useRef(null)

  // ==================== 角色选择区域状态 ====================
  // 远程 JSON 数据
  const [artsData, setArtsData] = useState(null)
  const [artsDataLoading, setArtsDataLoading] = useState(false)
  const [artsDataError, setArtsDataError] = useState(null)

  // 上传角色列表
  const [uploadedImages, setUploadedImages] = useState([])
  const [selectedUploadedImage, setSelectedUploadedImage] = useState(null)

  // 出处筛选器（最高维度）
  const [selectedComefrom, setSelectedComefrom] = useState('')
  // 条件子筛选器
  const [selectedProfession, setSelectedProfession] = useState('')
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedStar, setSelectedStar] = useState('')
  const [selectedGender, setSelectedGender] = useState('')
  // 角色和立绘选择
  const [selectedChar, setSelectedChar] = useState('')
  const [selectedSkinCode, setSelectedSkinCode] = useState('')

  // ==================== 上传模态框状态 ====================
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadForm] = Form.useForm()
  const [pendingUploadFile, setPendingUploadFile] = useState(null)
  const [pendingUploadDataUrl, setPendingUploadDataUrl] = useState('')

  // ==================== 数据加载 ====================
  useEffect(() => {
    const fetchArtsData = async () => {
      setArtsDataLoading(true)
      try {
        const resp = await fetch('/arts_data.json')
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        setArtsData(data)
      } catch (err) {
        console.error('加载角色数据失败:', err)
        setArtsDataError(err.message)
      } finally {
        setArtsDataLoading(false)
      }
    }
    fetchArtsData()
  }, [])

  // ==================== 派生数据 ====================
  // 合并内置角色 + 上传角色
  const allCharRecords = useMemo(() => {
    const builtIn = artsData?.角色 || []
    const uploaded = uploadedImages.map(img => ({
      角色名: img.charName,
      外文名: img.foreignName || '',
      性别: '其他',
      立绘: [{ 编号: '1', 文件名: img.fileName, 文件链接: '' }],
      logo: img.faction || '罗德岛',
      出处: '用户上传',
      信息: {},
      _dataUrl: img.dataUrl
    }))
    return [...builtIn, ...uploaded]
  }, [artsData, uploadedImages])

  // 出处选项列表
  const comefromOptions = useMemo(() => {
    const builtIn = (artsData?.元信息?.角色数 || [])
      .filter(item => item.出处 !== '不限')
      .map(item => item.出处)
    const hasUploaded = uploadedImages.length > 0
    return [...builtIn, ...(hasUploaded ? ['用户上传'] : [])]
  }, [artsData, uploadedImages])

  // 当前出处下的角色列表
  const comefromCharList = useMemo(() => {
    if (!selectedComefrom) return []
    return allCharRecords.filter(c => c.出处 === selectedComefrom)
  }, [selectedComefrom, allCharRecords])

  // 职业选项
  const professionOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const profs = [...new Set(
      comefromCharList
        .map(c => c.信息?.职业)
        .filter(Boolean)
    )].sort()
    return ['不限', ...profs]
  }, [selectedComefrom, comefromCharList])

  // 分支选项（级联职业）
  const branchOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const pool = selectedProfession && selectedProfession !== '不限'
      ? comefromCharList.filter(c => c.信息?.职业 === selectedProfession)
      : comefromCharList
    const branches = [...new Set(pool.map(c => c.信息?.分支).filter(Boolean))].sort()
    return ['不限', ...branches]
  }, [selectedComefrom, comefromCharList, selectedProfession])

  // 星级选项
  const starOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const stars = [...new Set(
      comefromCharList
        .map(c => c.信息?.星级)
        .filter(star => star != null)
    )].sort((a, b) => a - b)
    return ['不限', ...stars.map(String)]
  }, [selectedComefrom, comefromCharList])

  // 性别选项
  const genderOptions = useMemo(() => {
    if (!selectedComefrom) return []
    const genders = [...new Set(comefromCharList.map(c => c.性别).filter(Boolean))].sort()
    return ['不限', ...genders]
  }, [selectedComefrom, comefromCharList])

  // 筛选后的角色列表
  const filteredCharList = useMemo(() => {
    if (!selectedComefrom) return []
    let filtered = comefromCharList
    if (selectedProfession && selectedProfession !== '不限') {
      filtered = filtered.filter(c => c.信息?.职业 === selectedProfession)
    }
    if (selectedBranch && selectedBranch !== '不限') {
      filtered = filtered.filter(c => c.信息?.分支 === selectedBranch)
    }
    if (selectedStar && selectedStar !== '不限') {
      filtered = filtered.filter(c => String(c.信息?.星级) === selectedStar)
    }
    if (selectedGender && selectedGender !== '不限') {
      filtered = filtered.filter(c => c.性别 === selectedGender)
    }
    return filtered
  }, [comefromCharList, selectedProfession, selectedBranch, selectedStar, selectedGender])

  // 角色名列表（去重排序）
  const filteredCharNames = useMemo(() => {
    return [...new Set(filteredCharList.map(c => c.角色名))].sort()
  }, [filteredCharList])

  // 选中角色的完整记录
  const selectedCharRecord = useMemo(() => {
    if (!selectedChar) return null
    return filteredCharList.find(c => c.角色名 === selectedChar) || null
  }, [selectedChar, filteredCharList])

  // 选中角色的立绘列表
  const charartList = useMemo(() => {
    if (!selectedCharRecord) return []
    return selectedCharRecord.立绘 || []
  }, [selectedCharRecord])

  // 当前选中的立绘记录
  const selectedCharart = useMemo(() => {
    if (!selectedSkinCode || !selectedCharRecord) return null
    return selectedCharRecord.立绘?.find(p => p.编号 === selectedSkinCode) || null
  }, [selectedSkinCode, selectedCharRecord])

  // ==================== 上传处理 ====================
  const handleFileChange = ({ file }) => {
    if (!file || !file.originFileObj) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      const baseName = file.name.replace(/\.[^.]+$/, '')
      const parsed = parseArtFilename(file.name, true)
      setPendingUploadFile(file)
      setPendingUploadDataUrl(dataUrl)
      uploadForm.setFieldsValue({
        charName: parsed.name || baseName,
        foreignName: parsed.name || baseName,
        defaultFaction: parsed.faction || '罗德岛'
      })
      setUploadModalOpen(true)
    }
    reader.readAsDataURL(file.originFileObj)
  }

  const handleUploadModalOk = async () => {
    try {
      const values = await uploadForm.validateFields()
      const { charName, foreignName, defaultFaction } = values

      const allNames = allCharRecords.map(c => c.角色名)
      if (allNames.includes(charName)) {
        message.error(`角色名"${charName}"已存在，请修改`)
        return
      }

      const img = new window.Image()
      img.onload = () => {
        const newImage = {
          id: Date.now().toString(),
          name: charName,
          fileName: pendingUploadFile.name,
          dataUrl: pendingUploadDataUrl,
          width: img.width,
          height: img.height,
          charName,
          foreignName,
          faction: defaultFaction
        }
        const newList = [...uploadedImages, newImage]
        setUploadedImages(newList)
        setSelectedComefrom('用户上传')
        setSelectedChar(charName)
        setSelectedSkinCode('1')
        setSelectedUploadedImage(newImage.id)
        setSelectedFaction(null)
        setUploadModalOpen(false)
        uploadForm.resetFields()
        setPendingUploadFile(null)
        setPendingUploadDataUrl('')
        message.success('立绘上传成功')
      }
      img.onerror = () => {
        message.error('图片加载失败')
        setUploadModalOpen(false)
      }
      img.src = pendingUploadDataUrl
    } catch (err) {
      // 表单校验失败，不关闭
    }
  }

  const handleUploadModalCancel = () => {
    setUploadModalOpen(false)
    uploadForm.resetFields()
    setPendingUploadFile(null)
    setPendingUploadDataUrl('')
  }

  // ==================== 参数操作 ====================
  const handleReset = () => {
    setCharScale(1)
    setCharPos(0.5)
    setCharYOffset(0.5)
    setLogoScale(1)
    setSelectedFaction(null)
    setSelectedUploadedImage(null)
    setOutputQuality('4K')
    setSelectedComefrom('')
    setSelectedProfession('')
    setSelectedBranch('')
    setSelectedStar('')
    setSelectedGender('')
    setSelectedChar('')
    setSelectedSkinCode('')
    message.success('参数已重置')
  }

  // ==================== 合成图片 ====================
  const getLogoPath = useCallback((factionName) => {
    if (!factionName) return null
    const ext = factionExtMap[factionName] || 'png'
    return `logos/${factionName}.${ext}`
  }, [])

  const getCanvasSize = (quality) => {
    switch (quality) {
      case '4K': return { width: 3840, height: 2160 }
      case '2K': return { width: 2560, height: 1440 }
      case '1080p': return { width: 1920, height: 1080 }
      default: return { width: 3840, height: 2160 }
    }
  }

  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const { width, height } = getCanvasSize(outputQuality)
    canvas.width = width
    canvas.height = height

    // 确定立绘来源
    let charImage
    let charImageFallback = null
    const isUploadedChar = selectedComefrom === '用户上传'

    if (isUploadedChar) {
      const uploadedImg = uploadedImages.find(img => img.charName === selectedChar)
      if (uploadedImg) {
        charImage = uploadedImg.dataUrl
      }
    } else if (selectedCharart) {
      charImage = selectedCharart.文件链接
      charImageFallback = `chararts/${selectedCharart.文件名}`
    }

    if (!charImage) return

    // 确定 logo
    let logoPath = null
    const effectiveFaction = selectedFaction === null
      ? (selectedCharRecord?.logo || '')
      : selectedFaction
    if (effectiveFaction) {
      logoPath = getLogoPath(effectiveFaction)
    }

    setLoading(true)
    try {
      await composeImage(canvas, BG_FILENAME, charImage, logoPath, {
        charScale, charPos, charYOffset, logoScale, charImageFallback
      })
      const dataUrl = canvas.toDataURL('image/png')
      setPreviewUrl(dataUrl)
    } catch (err) {
      console.error('合成失败:', err)
      message.error('图片合成失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedComefrom, selectedChar, selectedCharart, selectedCharRecord,
      selectedFaction, charScale, charPos, charYOffset, logoScale,
      uploadedImages, outputQuality, getLogoPath])

  // 选中立绘后自动合成
  useEffect(() => {
    if (!selectedChar || !selectedSkinCode) return
    const timer = setTimeout(() => generateImage(), 200)
    return () => clearTimeout(timer)
  }, [generateImage])

  // 下载
  const handleDownload = () => {
    if (!previewUrl) { message.warning('请先生成图片'); return }
    const link = document.createElement('a')
    link.href = previewUrl
    let filename
    if (selectedChar && selectedSkinCode) {
      filename = `明日方舟_${selectedChar}_${selectedSkinCode}.png`
    } else {
      filename = '合成.png'
    }
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('下载开始')
  }

  // 势力选择值：null映射到本家logo名
  const factionSelectValue = selectedFaction === null
    ? (selectedCharRecord?.logo || undefined)
    : selectedFaction

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1800, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={iconUrl} alt="" style={{ width: 40, height: 40 }} />
        明日方舟立绘合成工具
      </h1>

      <Row gutter={[24, 24]}>
        {/* 左侧：参数面板 */}
        <Col xs={24} md={8}>
          <Card title="参数面板">
            {/* 上传区 */}
            <div style={{ marginBottom: 24 }}>
              <Upload
                accept="image/*"
                showUploadList={false}
                onChange={handleFileChange}
                customRequest={() => {}}
              >
                <Button icon={<UploadOutlined />} block>上传立绘图</Button>
              </Upload>
              {uploadedImages.length > 0 && (
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder="选择已上传的立绘"
                  value={selectedUploadedImage || undefined}
                  onChange={setSelectedUploadedImage}
                >
                  {uploadedImages.map(img => (
                    <Option key={img.id} value={img.id}>{img.charName}</Option>
                  ))}
                </Select>
              )}
            </div>

            {/* 势力Logo选择 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                势力Logo
                {selectedFaction === null && selectedCharRecord?.logo && (
                  <span style={{ color: '#999', fontSize: 12 }}> (本家{selectedCharRecord.logo})</span>
                )}
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择势力Logo（默认本家）"
                value={factionSelectValue || undefined}
                onChange={(val) => setSelectedFaction(val === '' ? '' : val)}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                <Option value="">(无logo)</Option>
                {factions.map(faction => (
                  <Option key={faction} value={faction}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <img
                        src={`logos/${faction}.${factionExtMap[faction] || 'png'}`}
                        alt=""
                        style={{ width: 16, height: 16, objectFit: 'contain' }}
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                      {faction}
                    </span>
                  </Option>
                ))}
              </Select>
            </div>

            {/* 立绘大小 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 80 }}>立绘大小</span>
                <Slider min={0.5} max={2} step={0.1} value={charScale} onChange={setCharScale} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 30, textAlign: 'right' }}>{charScale.toFixed(1)}</span>
              </div>
            </div>

            {/* X轴位置 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 80 }}>X轴位置</span>
                <Slider min={0.3} max={0.7} step={0.01} value={charPos} onChange={setCharPos} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 30, textAlign: 'right' }}>{(charPos * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Y轴位置 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 80 }}>Y轴位置</span>
                <Slider min={0.3} max={0.7} step={0.01} value={charYOffset} onChange={setCharYOffset} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 30, textAlign: 'right' }}>{(charYOffset * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Logo大小 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', minWidth: 80 }}>Logo大小</span>
                <Slider min={0.5} max={2} step={0.1} value={logoScale} onChange={setLogoScale} style={{ flex: 1 }} />
                <span style={{ color: '#8c8c8c', minWidth: 30, textAlign: 'right' }}>{logoScale.toFixed(1)}</span>
              </div>
            </div>

            {/* 输出质量 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                <Space>
                  输出质量
                  <Tooltip title={<span>4K: 3840×2160<br/>2K: 2560×1440<br/>1080p: 1920×1080</span>}>
                    <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 14 }} />
                  </Tooltip>
                </Space>
              </label>
              <Radio.Group value={outputQuality} onChange={(e) => setOutputQuality(e.target.value)} optionType="button" buttonStyle="solid">
                <Radio.Button value="4K">4K</Radio.Button>
                <Radio.Button value="2K">2K</Radio.Button>
                <Radio.Button value="1080p">1080p</Radio.Button>
              </Radio.Group>
            </div>

            {/* 操作按钮 */}
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Tooltip title="重置所有参数和选择">
                  <Button icon={<ReloadOutlined />} onClick={handleReset} block>重置</Button>
                </Tooltip>
              </Col>
              <Col span={12}>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} loading={loading} disabled={!previewUrl} block>下载</Button>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧：预览 */}
        <Col xs={24} md={16}>
          <Card title="预览">
            <div style={{ textAlign: 'center', minHeight: 400, position: 'relative' }}>
              {loading && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(245, 245, 245, 0.6)', zIndex: 1 }}>
                  <Spin />
                </div>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              {previewUrl ? (
                <AntImage
                  src={previewUrl}
                  alt="合成预览"
                  style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid #f0f0f0', cursor: 'pointer' }}
                  preview={{ src: previewUrl, mask: '点击查看大图' }}
                />
              ) : (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  选择出处、角色和立绘后显示预览
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 角色选择区（全宽） */}
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="角色选择">
            {artsDataLoading && <Spin tip="加载角色数据中..." />}
            {artsDataError && <div style={{ color: '#ff4d4f', marginBottom: 12 }}>数据加载失败: {artsDataError}</div>}

            {/* 出处筛选器 */}
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col span={24}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>出处</span>
                  <Select
                    style={{ flex: 1 }}
                    placeholder="选择出处"
                    value={selectedComefrom || undefined}
                    onChange={(val) => {
                      setSelectedComefrom(val)
                      setSelectedProfession('')
                      setSelectedBranch('')
                      setSelectedStar('')
                      setSelectedGender('')
                      setSelectedChar('')
                      setSelectedSkinCode('')
                    }}
                    allowClear
                  >
                    {comefromOptions.map(cf => (
                      <Option key={cf} value={cf}>{cf}</Option>
                    ))}
                  </Select>
                </div>
              </Col>
            </Row>

            {/* 条件子筛选器：方舟干员 / 终末地 */}
            {selectedComefrom && (selectedComefrom === '方舟干员' || selectedComefrom === '终末地') && (
              <>
                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>职业</span>
                      <Select
                        style={{ flex: 1 }}
                        placeholder="选择职业"
                        value={selectedProfession || undefined}
                        onChange={(val) => {
                          setSelectedProfession(val)
                          setSelectedBranch('')
                          setSelectedChar('')
                          setSelectedSkinCode('')
                        }}
                        allowClear
                      >
                        {professionOptions.map(p => (
                          <Option key={p} value={p}>{p}</Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>分支</span>
                      <Select
                        style={{ flex: 1 }}
                        placeholder="选择分支"
                        value={selectedBranch || undefined}
                        onChange={(val) => {
                          setSelectedBranch(val)
                          setSelectedChar('')
                          setSelectedSkinCode('')
                        }}
                        allowClear
                      >
                        {branchOptions.map(b => (
                          <Option key={b} value={b}>{b}</Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                </Row>

                <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>星级</span>
                      <Select
                        style={{ flex: 1 }}
                        placeholder="选择星级"
                        value={selectedStar || undefined}
                        onChange={(val) => {
                          setSelectedStar(val)
                          setSelectedChar('')
                          setSelectedSkinCode('')
                        }}
                        allowClear
                      >
                        {starOptions.map(s => (
                          <Option key={s} value={s}>{s === '不限' ? s : '★'.repeat(Number(s))}</Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>性别</span>
                      <Select
                        style={{ flex: 1 }}
                        placeholder="选择性别"
                        value={selectedGender || undefined}
                        onChange={(val) => {
                          setSelectedGender(val)
                          setSelectedChar('')
                          setSelectedSkinCode('')
                        }}
                        allowClear
                      >
                        {genderOptions.map(g => (
                          <Option key={g} value={g}>{g}</Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                </Row>
              </>
            )}

            {/* 角色下拉 + 立绘选择 */}
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col span={18}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
                    角色 <span style={{ color: '#1677ff', fontWeight: 400 }}>(共{filteredCharNames.length}个)</span>
                  </span>
                  <Select
                    style={{ flex: 1 }}
                    placeholder={selectedComefrom ? '选择角色' : '请先选择出处'}
                    value={selectedChar || undefined}
                    onChange={(val) => {
                      setSelectedChar(val)
                      setSelectedSkinCode('')
                    }}
                    showSearch
                    filterOption={(input, option) =>
                      option.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                    allowClear
                    disabled={!selectedComefrom}
                  >
                    {filteredCharNames.map(name => (
                      <Option key={name} value={name}>{name}</Option>
                    ))}
                  </Select>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>立绘</span>
                  <Select
                    style={{ flex: 1 }}
                    placeholder="立绘"
                    value={selectedSkinCode || undefined}
                    onChange={setSelectedSkinCode}
                    disabled={!selectedChar || charartList.length === 0}
                  >
                    {charartList.map(art => (
                      <Option key={art.编号} value={art.编号}>{codeToName(art.编号)}</Option>
                    ))}
                  </Select>
                </div>
              </Col>
            </Row>

            {/* 角色信息显示 */}
            {selectedCharRecord && (
              <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px 16px' }}>
                <Row gutter={[16, 8]}>
                  <Col span={4}>
                    <span style={{ color: '#8c8c8c' }}>角色名</span>
                    <div style={{ fontWeight: 500 }}>{selectedCharRecord.角色名}</div>
                  </Col>
                  <Col span={5}>
                    <span style={{ color: '#8c8c8c' }}>外文名</span>
                    <div>{selectedCharRecord.外文名 || '—'}</div>
                  </Col>
                  <Col span={3}>
                    <span style={{ color: '#8c8c8c' }}>出处</span>
                    <div>{selectedCharRecord.出处}</div>
                  </Col>
                  <Col span={3}>
                    <span style={{ color: '#8c8c8c' }}>星级</span>
                    <div>{selectedCharRecord.信息?.星级 ? '★'.repeat(selectedCharRecord.信息.星级) : '—'}</div>
                  </Col>
                  <Col span={3}>
                    <span style={{ color: '#8c8c8c' }}>职业</span>
                    <div>{selectedCharRecord.信息?.职业 || '—'}</div>
                  </Col>
                  <Col span={3}>
                    <span style={{ color: '#8c8c8c' }}>分支</span>
                    <div>{selectedCharRecord.信息?.分支 || '—'}</div>
                  </Col>
                  <Col span={3}>
                    <span style={{ color: '#8c8c8c' }}>势力</span>
                    <div>{selectedCharRecord.信息?.势力 || selectedCharRecord.logo || '—'}</div>
                  </Col>
                </Row>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 上传模态框 */}
      <Modal
        title="上传立绘"
        open={uploadModalOpen}
        onOk={handleUploadModalOk}
        onCancel={handleUploadModalCancel}
        okText="确认上传"
        cancelText="取消"
      >
        <Form form={uploadForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="charName"
            label="角色名"
            rules={[{ required: true, message: '请输入角色名' }]}
          >
            <Input placeholder="输入角色名（不与已有角色重复）" />
          </Form.Item>
          <Form.Item
            name="foreignName"
            label="外文名"
          >
            <Input placeholder="输入外文名" />
          </Form.Item>
          <Form.Item
            name="defaultFaction"
            label="默认Logo"
          >
            <Select placeholder="选择势力Logo" showSearch filterOption={(input, option) =>
              option.children?.toString().toLowerCase().includes(input.toLowerCase())
            }>
              {factions.map(faction => (
                <Option key={faction} value={faction}>{faction}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 页脚 */}
      <footer style={{ marginTop: 'auto', padding: '16px', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <div style={{ fontSize: 14, color: '#8c8c8c' }}>© 2026 ArkCharArt</div>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 14, color: '#8c8c8c' }}>
                你可能还需要…<a href="https://imgpress.3plus10i.top" target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>ImgPress快捷图片压缩</a>
              </span>
              <span style={{ color: '#d9d9d9' }}>|</span>
              <Tooltip title="项目主页">
                <a href="https://github.com/3plus10i/arkcharart" target="_blank" rel="noopener noreferrer">
                  <img src="github-favicon.svg" alt="GitHub" style={{ width: 16, height: 16, display: 'block' }} />
                </a>
              </Tooltip>
              <Tooltip title="作者主站">
                <a href="https://blog.3plus10i.top" target="_blank" rel="noopener noreferrer">
                  <img src="blog-icon.ico" alt="博客" style={{ width: 16, height: 16, display: 'block' }} />
                </a>
              </Tooltip>
              <span style={{ color: '#d9d9d9' }}>|</span>
              <Tooltip title="鹰角网络 - 明日方舟">
                <a href="https://ak.hypergryph.com/" target="_blank" rel="noopener noreferrer">
                  <img src="arknights-favicon.ico" alt="明日方舟" style={{ width: 16, height: 16, display: 'block' }} />
                </a>
              </Tooltip>
              <Tooltip title="PRTS - Wiki">
                <a href="https://prts.wiki" target="_blank" rel="noopener noreferrer">
                  <img src="prts-favicon.ico" alt="PRTS" style={{ width: 16, height: 16, display: 'block' }} />
                </a>
              </Tooltip>
            </div>
          </Col>
        </Row>
      </footer>
    </div>
  )
}

export default App
