import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Select, Button, Card, Row, Col, Slider, Image as AntImage, message, Upload, Radio, Tooltip, Space, Segmented, Spin } from 'antd'
import { DownloadOutlined, ReloadOutlined, UploadOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { composeImage } from './lib/composeImage'
import { BG_FILENAME } from './config'
import { factions } from './data/faction'
import { charsInfo } from './data/charsInfo'
import { initPresetArts, buildArtIndex, codeToName } from './lib/artListManager'
import { parseArtFilename } from './lib/parseArtFile'

const { Option } = Select

function App() {
  const [loading, setLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const [isInitialized, setIsInitialized] = useState(false)

  // 初始化预置立绘索引（只算一次）
  const { artList, professions, charMap } = useMemo(() => {
    const arts = initPresetArts()
    const { professions, charMap } = buildArtIndex(arts)
    return { artList: arts, professions, charMap }
  }, [])

  // 三级选择状态
  const [selectedProfession, setSelectedProfession] = useState('')
  const [selectedChar, setSelectedChar] = useState('')
  const [selectedSkin, setSelectedSkin] = useState('') // code

  // 参数状态
  const [charScale, setCharScale] = useState(1)
  const [charPos, setCharPos] = useState(0.5)
  const [logoScale, setLogoScale] = useState(1)
  const [selectedFaction, setSelectedFaction] = useState(null) // null=本家, ''=无logo, 其他=指定势力

  // 输出质量
  const [outputQuality, setOutputQuality] = useState('4K')

  // 立绘来源模式
  const [artSourceMode, setArtSourceMode] = useState('select')

  // 用户上传的立绘列表（含解析出的元信息）
  const [uploadedImages, setUploadedImages] = useState(() => {
    const saved = sessionStorage.getItem('arkcharart_uploaded')
    return saved ? JSON.parse(saved) : []
  })
  const [selectedUploadedImage, setSelectedUploadedImage] = useState(null)

  const canvasRef = useRef(null)

  // 当前选中角色下的立绘列表
  const availableSkins = selectedChar && charMap[selectedChar] ? charMap[selectedChar] : []

  // 当前选中皮肤对应的立绘记录
  const currentArt = availableSkins.find(s => s.code === selectedSkin) || null

  // 本家势力：从当前立绘记录或charsInfo获取
  const homeFaction = currentArt?.faction || (selectedChar ? charsInfo[selectedChar]?.faction : '') || ''

  // 本家标签文字
  const homeFactionLabel = homeFaction ? `本家${homeFaction}` : ''

  // 页面初始化：默认选择蓝毒
  useEffect(() => {
    if (isInitialized) return
    const defaultChar = '蓝毒'
    if (charMap[defaultChar] && charMap[defaultChar].length > 0) {
      setSelectedProfession('全部')
      setSelectedChar(defaultChar)
      setSelectedSkin(charMap[defaultChar][0].code)
    }
    setIsInitialized(true)
  }, [isInitialized, charMap])

  // 切换立绘/加载立绘时：自动设置本家势力
  useEffect(() => {
    if (artSourceMode !== 'select') return
    if (!selectedChar || !selectedSkin) return
    // 选中本家势力
    setSelectedFaction(null) // null表示"本家"
  }, [selectedChar, selectedSkin, artSourceMode])

  // 职业下拉菜单选项：固定前两个 + 实际职业列表
  const professionOptions = useMemo(() => {
    // 过滤掉"其他"，因为它已作为固定选项存在
    const realProfs = professions.filter(p => p !== '其他')
    return ['全部', '其他', ...realProfs]
  }, [professions])

  // 根据选择的职业获取角色列表
  const availableChars = useMemo(() => {
    if (!selectedProfession) return []
    const filtered = selectedProfession === '全部'
      ? artList
      : artList.filter(a => a.profession === selectedProfession)
    return filtered
      .map(a => a.name)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort()
  }, [selectedProfession, artList])

  // 职业变化
  const handleProfessionChange = (profession) => {
    setSelectedProfession(profession)
    setSelectedFaction(null)

    if (profession) {
      const filtered = profession === '全部'
        ? artList
        : artList.filter(a => a.profession === profession)
      const chars = filtered
        .map(a => a.name)
        .filter((v, i, arr) => arr.indexOf(v) === i)
      if (chars.length > 0) {
        setSelectedChar(chars.sort()[0])
        const skins = charMap[chars.sort()[0]]
        setSelectedSkin(skins && skins.length > 0 ? skins[0].code : '')
      } else {
        setSelectedChar('')
        setSelectedSkin('')
      }
    } else {
      setSelectedChar('')
      setSelectedSkin('')
    }
  }

  // 角色变化
  const handleCharChange = (char) => {
    setSelectedChar(char)
    setSelectedFaction(null)

    if (char) {
      const skins = charMap[char]
      setSelectedSkin(skins && skins.length > 0 ? skins[0].code : '')
    } else {
      setSelectedSkin('')
    }
  }

  // 查找立绘文件名
  const getArtFile = useCallback(() => {
    if (!selectedChar || !selectedSkin) return null
    const skins = charMap[selectedChar]
    if (!skins) return null
    const skin = skins.find(s => s.code === selectedSkin)
    return skin ? skin.file : null
  }, [selectedChar, selectedSkin, charMap])

  // 保存上传图片到sessionStorage
  const saveUploadedImages = (images) => {
    sessionStorage.setItem('arkcharart_uploaded', JSON.stringify(images))
  }

  // 处理上传图片
  const handleFileChange = ({ file }) => {
    if (!file || !file.originFileObj) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result
      const img = new window.Image()
      img.onload = () => {
        // 解析文件名（仅A类，降级到F类）
        const parsed = parseArtFilename(file.name, true)
        const newImage = {
          id: Date.now().toString(),
          name: file.name,
          dataUrl,
          width: img.width,
          height: img.height,
          // 解析结果
          charName: parsed.name,
          profession: parsed.profession,
          faction: parsed.faction
        }
        const newList = [...uploadedImages, newImage]
        setUploadedImages(newList)
        saveUploadedImages(newList)
        setSelectedUploadedImage(newImage.id)
        // 自动设置本家势力
        setSelectedFaction(null)
        message.success('立绘上传成功')
        setTimeout(() => generateImage(), 100)
      }
      img.onerror = () => message.error('图片加载失败')
      img.src = dataUrl
    }
    reader.readAsDataURL(file.originFileObj)
  }

  // 获取当前选中的上传图片对象
  const getSelectedUploadedImageObj = useCallback(() => {
    return uploadedImages.find(img => img.id === selectedUploadedImage)
  }, [uploadedImages, selectedUploadedImage])

  // 合成图片
  const generateImage = useCallback(async () => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const { width, height } = getCanvasSize()
    canvas.width = width
    canvas.height = height

    // 确定立绘来源
    let charImage
    const uploadedImgObj = getSelectedUploadedImageObj()
    if (uploadedImgObj) {
      charImage = uploadedImgObj.dataUrl
    } else {
      const artFile = getArtFile()
      if (!artFile) return
      charImage = `chararts/${artFile}`
    }

    // 确定势力Logo
    let logoPath = null
    // selectedFaction: null=本家, ''=无, 其他=指定
    let effectiveFaction = selectedFaction === null ? homeFaction : selectedFaction
    if (effectiveFaction) {
      logoPath = `logos/${effectiveFaction}.png`
    }

    setLoading(true)
    try {
      await composeImage(canvas, BG_FILENAME, charImage, logoPath, { charScale, charPos, logoScale })
      const dataUrl = canvas.toDataURL('image/png')
      setPreviewUrl(dataUrl)
    } catch (err) {
      console.error('合成失败:', err)
      message.error('图片合成失败: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedChar, selectedSkin, selectedFaction, homeFaction, charScale, charPos, logoScale, getArtFile, getSelectedUploadedImageObj, outputQuality])

  // 首次合成
  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedChar && selectedSkin) generateImage()
    }, 100)
    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 参数变化时重新合成
  useEffect(() => {
    if (!selectedChar || !selectedSkin) return
    const timer = setTimeout(() => generateImage(), 200)
    return () => clearTimeout(timer)
  }, [generateImage])

  // 下载
  const handleDownload = () => {
    if (!previewUrl) { message.warning('请先生成图片'); return }
    const link = document.createElement('a')
    link.href = previewUrl
    let filename
    const uploadedImgObj = getSelectedUploadedImageObj()
    if (uploadedImgObj) {
      filename = `自定义图片_${uploadedImgObj.name}`
    } else if (selectedChar && selectedSkin) {
      filename = `明日方舟_${selectedChar}_${selectedSkin}.png`
    } else {
      filename = '合成.png'
    }
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    message.success('下载开始')
  }

  const getCanvasSize = () => {
    switch (outputQuality) {
      case '4K': return { width: 3840, height: 2160 }
      case '2K': return { width: 2560, height: 1440 }
      case '1080p': return { width: 1920, height: 1080 }
      default: return { width: 3840, height: 2160 }
    }
  }

  const handleReset = () => {
    setCharScale(1)
    setCharPos(0.5)
    setLogoScale(1)
    setSelectedUploadedImage(null)
    setOutputQuality('4K')
    setArtSourceMode('select')
    message.success('参数已重置')
  }

  // 势力下拉菜单的选中值（null映射到homeFaction用于显示）
  const factionSelectValue = selectedFaction === null ? homeFaction : selectedFaction

  return (
    <div style={{ padding: '16px 24px', maxWidth: 1800, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/icon.png" alt="" style={{ width: 40, height: 40 }} />
        明日方舟立绘合成工具
      </h1>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card title="参数面板">
            {/* 立绘来源选择 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                立绘来源
              </label>
              <Segmented
                block
                value={artSourceMode}
                onChange={(value) => {
                  setArtSourceMode(value)
                  if (value === 'upload') {
                    if (uploadedImages.length > 0) {
                      setSelectedUploadedImage(uploadedImages[uploadedImages.length - 1].id)
                    }
                  } else {
                    setSelectedUploadedImage(null)
                  }
                }}
                options={[
                  { label: '选择立绘', value: 'select' },
                  {
                    label: (
                      <span>
                        上传图片
                        <Tooltip title={<span>你可以访问<a href="https://prts.wiki/w/%E5%B9%B2%E5%91%98%E4%B8%80%E8%A7%88" target="_blank" rel="noopener noreferrer" style={{ color: '#69c0ff' }}>PRTS干员一览</a>寻找干员资料，切换立绘/时装后下载使用<br/>上传的图片列表将保持，直到关闭页面</span>}>
                          <InfoCircleOutlined style={{ color: '#8c8c8c', fontSize: 12, marginLeft: 4 }} />
                        </Tooltip>
                      </span>
                    ),
                    value: 'upload'
                  }
                ]}
              />

              {/* 上传模式 */}
              {artSourceMode === 'upload' && (
                <div style={{ marginTop: 12 }}>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    onChange={handleFileChange}
                    customRequest={() => {}}
                  >
                    <Button icon={<UploadOutlined />} block>
                      上传立绘图
                    </Button>
                  </Upload>
                  {uploadedImages.length > 0 && (
                    <Select
                      style={{ width: '100%', marginTop: 8 }}
                      placeholder="选择已上传的立绘"
                      value={selectedUploadedImage || undefined}
                      onChange={setSelectedUploadedImage}
                    >
                      {uploadedImages.map(img => (
                        <Option key={img.id} value={img.id}>{img.name}</Option>
                      ))}
                    </Select>
                  )}
                </div>
              )}

              {/* 选择模式 */}
              {artSourceMode === 'select' && (
                <div style={{ marginTop: 12 }}>
                  <Row gutter={[12, 12]}>
                    <Col span={8}>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>职业</label>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="选择职业"
                        value={selectedProfession || undefined}
                        onChange={handleProfessionChange}
                        loading={loading}
                      >
                        {professionOptions.map(prof => (
                          <Option key={prof} value={prof}>{prof}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={8}>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>角色</label>
                      <Select
                        style={{ width: '100%' }}
                        placeholder="选择角色"
                        value={selectedChar || undefined}
                        onChange={handleCharChange}
                        loading={loading}
                        disabled={!selectedProfession}
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {availableChars.map(char => (
                          <Option key={char} value={char}>{char}</Option>
                        ))}
                      </Select>
                    </Col>
                    <Col span={8}>
                      <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>立绘</label>
                      <Select
                        style={{ width: '100%' }}
                        placeholder={selectedChar ? '选择立绘' : '请先选择角色'}
                        value={selectedSkin || undefined}
                        onChange={setSelectedSkin}
                        loading={loading}
                        disabled={!selectedChar}
                      >
                        {availableSkins.map(skin => (
                          <Option key={skin.code} value={skin.code}>{codeToName(skin.code)}</Option>
                        ))}
                      </Select>
                    </Col>
                  </Row>
                </div>
              )}
            </div>

            {/* 势力Logo选择 */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
                势力Logo {homeFactionLabel && <span style={{ color: '#999', fontSize: 12 }}>({homeFactionLabel})</span>}
              </label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择势力Logo（默认本家）"
                value={factionSelectValue || undefined}
                onChange={(val) => setSelectedFaction(val === '' ? '' : val)}
                loading={loading}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option.children.toLowerCase().includes(input.toLowerCase())
                }
              >
                <Option value="">(无logo)</Option>
                {factions.map(faction => (
                  <Option key={faction} value={faction}>{faction}</Option>
                ))}
              </Select>
            </div>

            {/* 立绘倍率 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 500 }}>立绘图片大小</label>
                <span style={{ color: '#8c8c8c' }}>{charScale.toFixed(1)}</span>
              </div>
              <Slider min={0.5} max={2} step={0.1} value={charScale} onChange={setCharScale} disabled={!selectedSkin} />
            </div>

            {/* 立绘位置 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 500 }}>立绘图片位置</label>
                <span style={{ color: '#8c8c8c' }}>{(charPos * 100).toFixed(0)}%</span>
              </div>
              <Slider min={0.3} max={0.7} step={0.01} value={charPos} onChange={setCharPos} disabled={!selectedSkin} />
            </div>

            {/* Logo倍率 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 500 }}>Logo大小</label>
                <span style={{ color: '#8c8c8c' }}>{logoScale.toFixed(1)}</span>
              </div>
              <Slider min={0.5} max={2} step={0.1} value={logoScale} onChange={setLogoScale} disabled={!selectedSkin} />
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
                <Tooltip title="重置范围：立绘来源、立绘大小/位置、Logo大小、输出质量">
                  <Button icon={<ReloadOutlined />} onClick={handleReset} disabled={!selectedSkin} block>
                    重置
                  </Button>
                </Tooltip>
              </Col>
              <Col span={12}>
                <Button type="primary" icon={<DownloadOutlined />} onClick={handleDownload} loading={loading} disabled={!previewUrl} block>
                  下载
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

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
                  选择职业、角色和立绘后显示预览
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

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
